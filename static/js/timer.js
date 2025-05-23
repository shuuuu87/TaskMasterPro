// Timer Management System
class TimerManager {
    constructor() {
        this.activeTimer = null;
        this.timerData = {};
        this.loadTimerData();
        this.initializeEventListeners();
        this.restoreActiveTimers();
    }

    // Load timer data from localStorage
    loadTimerData() {
        const stored = localStorage.getItem('taskTimers');
        if (stored) {
            try {
                this.timerData = JSON.parse(stored);
            } catch (e) {
                console.error('Error loading timer data:', e);
                this.timerData = {};
            }
        }
    }

    // Save timer data to localStorage
    saveTimerData() {
        localStorage.setItem('taskTimers', JSON.stringify(this.timerData));
    }

    // Initialize event listeners
    initializeEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('start-timer')) {
                this.handleStartTimer(e);
            } else if (e.target.classList.contains('pause-timer')) {
                this.handlePauseTimer(e);
            } else if (e.target.classList.contains('resume-timer')) {
                this.handleResumeTimer(e);
            } else if (e.target.classList.contains('complete-timer')) {
                this.handleCompleteTimer(e);
            } else if (e.target.classList.contains('fullscreen-timer')) {
                this.handleFullscreenTimer(e);
            }
        });
    }

    // Start timer for a task
    handleStartTimer(e) {
        const taskId = e.target.dataset.taskId;
        const duration = parseInt(e.target.dataset.duration);
        
        // Stop any currently active timer
        if (this.activeTimer && this.activeTimer !== taskId) {
            this.pauseTimer(this.activeTimer);
        }

        this.startTimer(taskId, duration);
    }

    // Pause timer
    handlePauseTimer(e) {
        const taskId = e.target.dataset.taskId;
        this.pauseTimer(taskId);
    }

    // Resume timer
    handleResumeTimer(e) {
        const taskId = e.target.dataset.taskId;
        this.resumeTimer(taskId);
    }

    // Complete timer
    handleCompleteTimer(e) {
        const taskId = e.target.dataset.taskId;
        this.completeTimer(taskId);
    }

    // Handle fullscreen timer
    handleFullscreenTimer(e) {
        const taskId = e.target.dataset.taskId;
        const url = `/fullscreen_timer/${taskId}`;
        window.open(url, '_blank', 'fullscreen=yes,scrollbars=no,resizable=no');
    }

    // Start a timer
    startTimer(taskId, duration) {
        const now = Date.now();
        
        // Initialize or update timer data
        if (!this.timerData[taskId]) {
            this.timerData[taskId] = {
                startTime: now,
                elapsedTime: 0,
                duration: duration * 60 * 1000, // Convert to milliseconds
                isPaused: false,
                remaining: duration * 60 * 1000
            };
        } else {
            // Resume from pause
            this.timerData[taskId].startTime = now;
            this.timerData[taskId].isPaused = false;
        }

        this.activeTimer = taskId;
        this.saveTimerData();
        this.updateTimerUI(taskId);
        this.startTimerInterval(taskId);
    }

    // Pause a timer
    pauseTimer(taskId) {
        if (!this.timerData[taskId]) return;

        const now = Date.now();
        const runTime = now - this.timerData[taskId].startTime;
        this.timerData[taskId].elapsedTime += runTime;
        this.timerData[taskId].remaining -= runTime;
        this.timerData[taskId].isPaused = true;

        if (this.activeTimer === taskId) {
            this.activeTimer = null;
        }

        this.saveTimerData();
        this.updateTimerUI(taskId);
        this.stopTimerInterval(taskId);
    }

    // Resume a timer
    resumeTimer(taskId) {
        if (!this.timerData[taskId] || !this.timerData[taskId].isPaused) return;

        // Stop any other active timer
        if (this.activeTimer && this.activeTimer !== taskId) {
            this.pauseTimer(this.activeTimer);
        }

        this.startTimer(taskId, this.timerData[taskId].remaining / (60 * 1000));
    }

    // Complete a timer
    completeTimer(taskId) {
        if (!this.timerData[taskId]) return;

        // Calculate actual time worked
        let totalWorked = this.timerData[taskId].elapsedTime;
        if (!this.timerData[taskId].isPaused) {
            const now = Date.now();
            totalWorked += (now - this.timerData[taskId].startTime);
        }

        const minutesWorked = Math.round(totalWorked / (60 * 1000));

        // Submit completion form
        this.submitTaskCompletion(taskId, minutesWorked);

        // Clean up timer data
        delete this.timerData[taskId];
        this.saveTimerData();
        
        if (this.activeTimer === taskId) {
            this.activeTimer = null;
        }
    }

    // Submit task completion
    submitTaskCompletion(taskId, minutesWorked) {
        const form = document.getElementById('complete-task-form') || 
                    document.getElementById('fullscreen-complete-form');
        
        if (form) {
            const input = form.querySelector('input[name="time_taken"]');
            if (input) {
                input.value = minutesWorked;
                form.action = `/complete_task/${taskId}`;
                form.submit();
            }
        }
    }

    // Start timer interval
    startTimerInterval(taskId) {
        this.stopTimerInterval(taskId); // Clear any existing interval
        
        this[`interval_${taskId}`] = setInterval(() => {
            this.updateTimerDisplay(taskId);
        }, 1000);
    }

    // Stop timer interval
    stopTimerInterval(taskId) {
        if (this[`interval_${taskId}`]) {
            clearInterval(this[`interval_${taskId}`]);
            delete this[`interval_${taskId}`];
        }
    }

    // Update timer display
    updateTimerDisplay(taskId) {
        if (!this.timerData[taskId] || this.timerData[taskId].isPaused) return;

        const now = Date.now();
        const runTime = now - this.timerData[taskId].startTime;
        const remaining = this.timerData[taskId].remaining - runTime;

        if (remaining <= 0) {
            // Timer finished
            this.completeTimer(taskId);
            return;
        }

        // Update display
        const minutes = Math.floor(remaining / (60 * 1000));
        const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update regular timer display
        const timerElement = document.querySelector(`#timer-${taskId} .timer-display`);
        if (timerElement) {
            timerElement.textContent = display;
        }

        // Update fullscreen timer display
        const fullscreenElement = document.getElementById('fullscreen-timer-display');
        if (fullscreenElement && this.activeTimer === taskId) {
            fullscreenElement.textContent = display;
        }

        // Update progress bar
        const progressElement = document.querySelector(`#timer-${taskId} .progress-bar`);
        if (progressElement) {
            const totalDuration = this.timerData[taskId].duration;
            const progress = ((totalDuration - remaining) / totalDuration) * 100;
            progressElement.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        }

        // Update fullscreen progress ring
        const progressRing = document.querySelector('.progress-ring-progress');
        if (progressRing && this.activeTimer === taskId) {
            const totalDuration = this.timerData[taskId].duration;
            const progress = ((totalDuration - remaining) / totalDuration);
            const circumference = 2 * Math.PI * 140; // radius = 140
            const offset = circumference * (1 - progress);
            progressRing.style.strokeDashoffset = offset;
        }
    }

    // Update timer UI buttons
    updateTimerUI(taskId) {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`).closest('.task-card');
        if (!taskCard) return;

        const startBtn = taskCard.querySelector('.start-timer');
        const pauseBtn = taskCard.querySelector('.pause-timer');
        const resumeBtn = taskCard.querySelector('.resume-timer');
        const completeBtn = taskCard.querySelector('.complete-timer');
        const fullscreenBtn = taskCard.querySelector('.fullscreen-timer');

        if (!this.timerData[taskId]) {
            // No timer data - show start button
            if (startBtn) startBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (completeBtn) completeBtn.style.display = 'none';
            return;
        }

        if (this.timerData[taskId].isPaused) {
            // Timer is paused
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'inline-block';
            if (completeBtn) completeBtn.style.display = 'inline-block';
        } else {
            // Timer is running
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (completeBtn) completeBtn.style.display = 'inline-block';
        }
    }

    // Restore active timers on page load
    restoreActiveTimers() {
        Object.keys(this.timerData).forEach(taskId => {
            this.updateTimerUI(taskId);
            
            if (!this.timerData[taskId].isPaused) {
                this.activeTimer = taskId;
                this.startTimerInterval(taskId);
            } else {
                // Update display for paused timers
                const remaining = this.timerData[taskId].remaining;
                const minutes = Math.floor(remaining / (60 * 1000));
                const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
                const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                const timerElement = document.querySelector(`#timer-${taskId} .timer-display`);
                if (timerElement) {
                    timerElement.textContent = display;
                }
            }
        });
    }
}

// Fullscreen Timer Manager
class FullscreenTimerManager extends TimerManager {
    constructor() {
        super();
        this.initializeFullscreenListeners();
    }

    initializeFullscreenListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('start-fullscreen-timer')) {
                this.handleStartFullscreenTimer(e);
            } else if (e.target.classList.contains('pause-fullscreen-timer')) {
                this.handlePauseFullscreenTimer(e);
            } else if (e.target.classList.contains('resume-fullscreen-timer')) {
                this.handleResumeFullscreenTimer(e);
            } else if (e.target.classList.contains('complete-fullscreen-timer')) {
                this.handleCompleteFullscreenTimer(e);
            }
        });
    }

    handleStartFullscreenTimer(e) {
        const taskId = e.target.dataset.taskId;
        const duration = parseInt(e.target.dataset.duration);
        this.startTimer(taskId, duration);
        this.updateFullscreenUI(taskId);
    }

    handlePauseFullscreenTimer(e) {
        const taskId = e.target.dataset.taskId;
        this.pauseTimer(taskId);
        this.updateFullscreenUI(taskId);
    }

    handleResumeFullscreenTimer(e) {
        const taskId = e.target.dataset.taskId;
        this.resumeTimer(taskId);
        this.updateFullscreenUI(taskId);
    }

    handleCompleteFullscreenTimer(e) {
        const taskId = e.target.dataset.taskId;
        this.completeTimer(taskId);
    }

    updateFullscreenUI(taskId) {
        const startBtn = document.querySelector('.start-fullscreen-timer');
        const pauseBtn = document.querySelector('.pause-fullscreen-timer');
        const resumeBtn = document.querySelector('.resume-fullscreen-timer');
        const completeBtn = document.querySelector('.complete-fullscreen-timer');

        if (!this.timerData[taskId]) {
            if (startBtn) startBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (completeBtn) completeBtn.style.display = 'none';
            return;
        }

        if (this.timerData[taskId].isPaused) {
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'inline-block';
            if (completeBtn) completeBtn.style.display = 'inline-block';
        } else {
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (completeBtn) completeBtn.style.display = 'inline-block';
        }
    }
}

// Global timer manager instance
let timerManager;

// Initialize timers when DOM is loaded
function initializeTimers() {
    timerManager = new TimerManager();
}

// Initialize fullscreen timer
function initializeFullscreenTimer() {
    timerManager = new FullscreenTimerManager();
    
    // Restore any existing timer for this task
    const taskId = document.querySelector('[data-task-id]')?.dataset.taskId;
    if (taskId && timerManager.timerData[taskId]) {
        timerManager.updateFullscreenUI(taskId);
        if (!timerManager.timerData[taskId].isPaused) {
            timerManager.activeTimer = taskId;
            timerManager.startTimerInterval(taskId);
        }
    }
}

// Utility functions for keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space bar to pause/resume active timer
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (timerManager && timerManager.activeTimer) {
            const taskId = timerManager.activeTimer;
            if (timerManager.timerData[taskId].isPaused) {
                timerManager.resumeTimer(taskId);
            } else {
                timerManager.pauseTimer(taskId);
            }
        }
    }
    
    // Escape key to exit fullscreen
    if (e.code === 'Escape' && window.location.pathname.includes('/fullscreen_timer/')) {
        if (confirm('Are you sure you want to exit fullscreen mode?')) {
            window.close();
        }
    }
});

// Handle page visibility change to pause timers when tab is not visible
document.addEventListener('visibilitychange', () => {
    if (timerManager && timerManager.activeTimer) {
        if (document.hidden) {
            // Page is hidden, could pause timer here if desired
            console.log('Page hidden, timer continues running...');
        } else {
            // Page is visible again, ensure timer is still running
            console.log('Page visible, timer restored...');
        }
    }
});

// Handle before page unload to save timer state
window.addEventListener('beforeunload', () => {
    if (timerManager) {
        timerManager.saveTimerData();
    }
});
