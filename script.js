class AudioVisualizer {
    constructor() {
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.animationId = null;
        this.audio = null;
        this.isPlaying = false;
        this.mode = 'bars';

        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        const resizeCanvas = () => {
            this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
            this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
            this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    setupEventListeners() {
        document.getElementById('audioFile').addEventListener('change', (e) => {
            this.loadAudioFile(e.target.files[0]);
        });

        document.getElementById('micBtn').addEventListener('click', () => {
            this.startMicrophone();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stop();
        });

        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            if (this.audio) {
                this.audio.volume = e.target.value / 100;
            }
        });

        document.getElementById('sensitivitySlider').addEventListener('input', (e) => {
            this.sensitivity = e.target.value;
        });

        document.getElementById('smoothingSlider').addEventListener('input', (e) => {
            if (this.analyser) {
                this.analyser.smoothingTimeConstant = e.target.value / 100;
            }
        });

        document.getElementById('progressBar').addEventListener('click', (e) => {
            if (this.audio) {
                const rect = e.target.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.audio.currentTime = percent * this.audio.duration;
            }
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
            });
        });

        this.sensitivity = 5;
    }

    async loadAudioFile(file) {
        if (!file) return;

        try {
            this.showStatus('Loading audio file...', 'info');

            if (this.audio) {
                this.audio.pause();
                this.audio.remove();
            }

            this.audio = new Audio();
            this.audio.src = URL.createObjectURL(file);

            this.audio.addEventListener('loadedmetadata', () => {
                this.updateDuration();
                this.showStatus('Audio loaded successfully!', 'success');
            });

            this.audio.addEventListener('timeupdate', () => {
                this.updateProgress();
            });

            this.audio.addEventListener('ended', () => {
                this.isPlaying = false;
                document.getElementById('stopBtn').disabled = true;
            });

            await this.setupAudioContext();
            this.audio.play();
            this.isPlaying = true;
            document.getElementById('stopBtn').disabled = false;

        } catch (error) {
            this.showStatus('Error loading audio file: ' + error.message, 'error');
        }
    }

    async startMicrophone() {
        try {
            this.showStatus('Requesting microphone access...', 'info');

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (this.audio) {
                this.audio.pause();
            }

            await this.setupAudioContext();
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.analyser);

            this.isPlaying = true;
            document.getElementById('stopBtn').disabled = false;
            this.showStatus('Microphone connected!', 'success');

        } catch (error) {
            this.showStatus('Error accessing microphone: ' + error.message, 'error');
        }
    }

    async setupAudioContext() {
        if (this.audioContext) {
            this.audioContext.close();
        }

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();

        this.analyser.fftSize = 512;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        this.analyser.smoothingTimeConstant = 0.8;

        if (this.audio) {
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        }

        this.startVisualization();
    }

    startVisualization() {
        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(this.dataArray);

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.fillRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);

            switch (this.mode) {
                case 'bars':
                    this.drawBars();
                    break;
                case 'wave':
                    this.drawWave();
                    break;
                case 'circle':
                    this.drawCircle();
                    break;
                case 'mirror':
                    this.drawMirror();
                    break;
            }
        };

        draw();
    }

    drawBars() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        const barWidth = width / this.bufferLength * 2;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.dataArray[i] / 255) * height * (this.sensitivity / 5);

            const gradient = this.ctx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, `hsl(${(i / this.bufferLength) * 360}, 70%, 60%)`);
            gradient.addColorStop(1, `hsl(${(i / this.bufferLength) * 360}, 70%, 30%)`);

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }
    }

    drawWave() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#c3aed6';
        this.ctx.beginPath();

        const sliceWidth = width / this.bufferLength;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 255;
            const y = height - (v * height * (this.sensitivity / 5));

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.stroke();
    }

    drawCircle() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 4;

        for (let i = 0; i < this.bufferLength; i++) {
            const angle = (i / this.bufferLength) * Math.PI * 2;
            const barHeight = (this.dataArray[i] / 255) * radius * (this.sensitivity / 5);

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, `hsl(${(i / this.bufferLength) * 360}, 70%, 60%)`);
            gradient.addColorStop(1, `hsl(${(i / this.bufferLength) * 360}, 70%, 30%)`);

            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    }

    drawMirror() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        const barWidth = width / this.bufferLength * 4;
        let x = 0;

        for (let i = 0; i < this.bufferLength / 2; i++) {
            const barHeight = (this.dataArray[i] / 255) * (height / 2) * (this.sensitivity / 5);

            const gradient = this.ctx.createLinearGradient(0, height/2 - barHeight, 0, height/2 + barHeight);
            gradient.addColorStop(0, `hsl(${(i / this.bufferLength) * 720}, 70%, 60%)`);
            gradient.addColorStop(0.5, `hsl(${(i / this.bufferLength) * 720}, 70%, 50%)`);
            gradient.addColorStop(1, `hsl(${(i / this.bufferLength) * 720}, 70%, 30%)`);

            this.ctx.fillStyle = gradient;

            // Top bar
            this.ctx.fillRect(x, height/2 - barHeight, barWidth - 1, barHeight);
            // Bottom bar (mirror)
            this.ctx.fillRect(x, height/2, barWidth - 1, barHeight);

            x += barWidth;
        }
    }

    updateProgress() {
        if (this.audio) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
            document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateDuration() {
        if (this.audio) {
            document.getElementById('duration').textContent = this.formatTime(this.audio.duration);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.isPlaying = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('currentTime').textContent = '0:00';

        this.ctx.clearRect(0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.showStatus('Visualization stopped', 'info');
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';

        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

// Initialize the visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
