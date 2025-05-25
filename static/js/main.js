// Timer System with localStorage persistence
class TimerManager {
    constructor() {
        this.timers = {};
        this.activeTimer = null;
        this.fullscreenModal = null;
        this.init();
    }

    init() {
        // Load timers from localStorage
        this.loadTimersFromStorage();
        
        // Initialize fullscreen modal
        this.fullscreenModal = new bootstrap.Modal(document.getElementById('fullscreenTimerModal'));
        
        // Bind event listeners
        this.bindEvents();
        
        // Restore any active timers
        this.restoreActiveTimers();
        
        // Update UI every second
        setInterval(() => this.updateAllTimers(), 1000);
    }

    bindEvents() {
        // Start timer buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('start-timer') || e.target.closest('.start-timer')) {
                const btn = e.target.classList.contains('start-timer') ? e.target : e.target.closest('.start-timer');
                this.startTimer(btn.dataset.taskId, parseInt(btn.dataset.duration));
            }
        });

        // Pause timer buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('pause-timer') || e.target.closest('.pause-timer')) {
                const btn = e.target.classList.contains('pause-timer') ? e.target : e.target.closest('.pause-timer');
                this.pauseTimer(btn.dataset.taskId);
            }
        });

        // Resume timer buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('resume-timer') || e.target.closest('.resume-timer')) {
                const btn = e.target.classList.contains('resume-timer') ? e.target : e.target.closest('.resume-timer');
                this.resumeTimer(btn.dataset.taskId);
            }
        });

        // Fullscreen timer buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('fullscreen-timer') || e.target.closest('.fullscreen-timer')) {
                const btn = e.target.classList.contains('fullscreen-timer') ? e.target : e.target.closest('.fullscreen-timer');
                this.openFullscreenTimer(btn.dataset.taskId, btn.dataset.taskName);
            }
        });

        // Fullscreen modal controls
        document.getElementById('fullscreen-pause-btn').addEventListener('click', () => {
            if (this.activeTimer) {
                this.pauseTimer(this.activeTimer);
                this.updateFullscreenControls();
            }
        });

        document.getElementById('fullscreen-resume-btn').addEventListener('click', () => {
            if (this.activeTimer) {
                this.resumeTimer(this.activeTimer);
                this.updateFullscreenControls();
            }
        });

        document.getElementById('fullscreen-complete-btn').addEventListener('click', () => {
            if (this.activeTimer) {
                this.completeTaskFromFullscreen(this.activeTimer);
            }
        });

        // Complete task forms
        document.addEventListener('submit', (e) => {
            if (e.target.classList.contains('complete-form')) {
                const taskId = this.getTaskIdFromForm(e.target);
                if (taskId && this.timers[taskId]) {
                    const actualMinutes = this.calculateActualMinutes(taskId);
                    e.target.querySelector('.actual-minutes').value = actualMinutes;
                }
            }
        });
    }

    startTimer(taskId, duration) {
        // Stop any currently active timer
        if (this.activeTimer && this.activeTimer !== taskId) {
            this.pauseTimer(this.activeTimer);
        }

        const now = Date.now();
        const durationMs = duration * 60 * 1000;

        // Check if timer already exists (resuming)
        if (this.timers[taskId]) {
            this.timers[taskId].startTime = now;
            this.timers[taskId].isPaused = false;
        } else {
            // Create new timer
            this.timers[taskId] = {
                startTime: now,
                elapsedTime: 0,
                isPaused: false,
                remaining: durationMs,
                originalDuration: duration
            };
        }

        this.activeTimer = taskId;
        this.updateTimerControls(taskId, 'running');
        this.saveTimersToStorage();
    }

    pauseTimer(taskId) {
        if (!this.timers[taskId] || this.timers[taskId].isPaused) return;

        const now = Date.now();
        const sessionTime = now - this.timers[taskId].startTime;
        this.timers[taskId].elapsedTime += sessionTime;
        this.timers[taskId].remaining -= sessionTime;
        this.timers[taskId].isPaused = true;

        if (this.activeTimer === taskId) {
            this.activeTimer = null;
        }

        this.updateTimerControls(taskId, 'paused');
        this.saveTimersToStorage();
    }

    resumeTimer(taskId) {
        if (!this.timers[taskId] || !this.timers[taskId].isPaused) return;

        this.timers[taskId].startTime = Date.now();
        this.timers[taskId].isPaused = false;
        this.activeTimer = taskId;

        this.updateTimerControls(taskId, 'running');
        this.saveTimersToStorage();
    }

    updateAllTimers() {
        const now = Date.now();

        Object.keys(this.timers).forEach(taskId => {
            const timer = this.timers[taskId];
            if (!timer.isPaused && timer.remaining > 0) {
                const sessionTime = now - timer.startTime;
                const totalElapsed = timer.elapsedTime + sessionTime;
                const remaining = Math.max(0, timer.remaining - sessionTime);

                this.updateTimerDisplay(taskId, remaining);

                // Auto-complete when timer reaches 0
                if (remaining === 0) {
                    this.autoCompleteTask(taskId);
                }
            } else if (timer.isPaused) {
                this.updateTimerDisplay(taskId, timer.remaining);
            }
        });
    }

    updateTimerDisplay(taskId, remainingMs) {
        const timerElement = document.getElementById(`timer-${taskId}`);
        if (!timerElement) return;

        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        timerElement.textContent = timeString;

        // Update fullscreen timer if active
        if (this.activeTimer === taskId) {
            const fullscreenTimer = document.getElementById('fullscreen-timer');
            if (fullscreenTimer) {
                fullscreenTimer.textContent = timeString;
            }
        }

        // Add visual feedback for low time
        if (remainingMs < 60000) { // Less than 1 minute
            timerElement.classList.add('text-danger');
        } else if (remainingMs < 300000) { // Less than 5 minutes
            timerElement.classList.add('text-warning');
        } else {
            timerElement.classList.remove('text-danger', 'text-warning');
        }
    }

    updateTimerControls(taskId, state) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskElement) return;
        
        const container = taskElement.closest('.task-card');
        if (!container) return;

        const startBtn = container.querySelector('.start-timer');
        const pauseBtn = container.querySelector('.pause-timer');
        const resumeBtn = container.querySelector('.resume-timer');
        const completeBtn = container.querySelector('.complete-task');

        // Reset all buttons
        [startBtn, pauseBtn, resumeBtn].forEach(btn => {
            if (btn) btn.classList.add('d-none');
        });

        switch (state) {
            case 'idle':
                if (startBtn) startBtn.classList.remove('d-none');
                if (completeBtn) completeBtn.disabled = true;
                break;
            case 'running':
                if (pauseBtn) pauseBtn.classList.remove('d-none');
                if (completeBtn) completeBtn.disabled = false;
                break;
            case 'paused':
                if (resumeBtn) resumeBtn.classList.remove('d-none');
                if (completeBtn) completeBtn.disabled = false;
                break;
        }
    }

    openFullscreenTimer(taskId, taskName) {
        const fullscreenTaskName = document.getElementById('fullscreen-task-name');
        if (fullscreenTaskName) {
            fullscreenTaskName.textContent = taskName;
        }

        // Set active timer for fullscreen display updates
        this.activeTimer = taskId;
        this.updateFullscreenControls();
        this.fullscreenModal.show();

        // Update fullscreen timer display with current timer state
        if (this.timers[taskId]) {
            // Timer exists, update display
            this.updateTimerDisplay(taskId, this.timers[taskId].remaining);
        } else {
            // No timer yet, show original duration
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                const container = taskElement.closest('.task-card');
                const startBtn = container?.querySelector('.start-timer');
                const duration = startBtn?.dataset.duration;
                if (duration) {
                    const fullscreenTimer = document.getElementById('fullscreen-timer');
                    if (fullscreenTimer) {
                        const minutes = parseInt(duration);
                        fullscreenTimer.textContent = `${minutes.toString().padStart(2, '0')}:00`;
                    }
                }
            }
        }
    }

    updateFullscreenControls() {
        const pauseBtn = document.getElementById('fullscreen-pause-btn');
        const resumeBtn = document.getElementById('fullscreen-resume-btn');

        if (this.activeTimer && this.timers[this.activeTimer]) {
            const isPaused = this.timers[this.activeTimer].isPaused;
            pauseBtn.classList.toggle('d-none', isPaused);
            resumeBtn.classList.toggle('d-none', !isPaused);
        }
    }

    autoCompleteTask(taskId) {
        this.pauseTimer(taskId);
        
        // Calculate actual time worked
        const actualMinutes = this.calculateActualMinutes(taskId);
        
        // Submit completion form automatically
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            const container = taskElement.closest('.task-card');
            const form = container?.querySelector('.complete-form');
            
            if (form) {
                form.querySelector('.actual-minutes').value = actualMinutes;
                form.submit();
            }
        }
        
        // Close fullscreen if open
        if (this.activeTimer === taskId) {
            this.fullscreenModal.hide();
        }
        
        // Clean up timer
        delete this.timers[taskId];
        this.saveTimersToStorage();
        
        // Show completion notification
        this.showNotification('Task completed automatically!', 'success');
    }

    completeTaskFromFullscreen(taskId) {
        const actualMinutes = this.calculateActualMinutes(taskId);
        
        // Find and submit the completion form
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            const container = taskElement.closest('.task-card');
            const form = container?.querySelector('.complete-form');
            
            if (form) {
                form.querySelector('.actual-minutes').value = actualMinutes;
                this.fullscreenModal.hide();
                form.submit();
            }
        }
    }

    calculateActualMinutes(taskId) {
        if (!this.timers[taskId]) return 0;

        const timer = this.timers[taskId];
        const now = Date.now();
        let totalElapsed = timer.elapsedTime;

        if (!timer.isPaused) {
            totalElapsed += (now - timer.startTime);
        }

        return Math.round(totalElapsed / 60000); // Convert to minutes
    }

    getTaskIdFromForm(form) {
        const action = form.action;
        const match = action.match(/\/complete_task\/(\d+)/);
        return match ? match[1] : null;
    }

    loadTimersFromStorage() {
        try {
            const stored = localStorage.getItem('taskTimers');
            if (stored) {
                this.timers = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading timers from storage:', error);
            this.timers = {};
        }
    }

    saveTimersToStorage() {
        try {
            localStorage.setItem('taskTimers', JSON.stringify(this.timers));
        } catch (error) {
            console.error('Error saving timers to storage:', error);
        }
    }

    restoreActiveTimers() {
        Object.keys(this.timers).forEach(taskId => {
            const timer = this.timers[taskId];
            if (timer.isPaused) {
                this.updateTimerControls(taskId, 'paused');
            } else if (timer.remaining > 0) {
                this.activeTimer = taskId;
                this.updateTimerControls(taskId, 'running');
            }
        });
    }

    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 100px; right: 20px; z-index: 9999; max-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Utility Functions
function initializeTimers() {
    window.timerManager = new TimerManager();
}

// Page-specific initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Add smooth scrolling to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Auto-dismiss alerts after 5 seconds
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
        alerts.forEach(alert => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);

    // Add loading states to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
                
                // Re-enable after 5 seconds as failsafe
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }, 5000);
            }
        });
    });

    // Add confirmation to delete buttons
    document.querySelectorAll('.btn-danger').forEach(btn => {
        if (btn.textContent.includes('Delete')) {
            btn.addEventListener('click', function(e) {
                if (!confirm('Are you sure you want to delete this item?')) {
                    e.preventDefault();
                }
            });
        }
    });

    // Animate cards on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all cards
    document.querySelectorAll('.card, .stat-card, .task-card').forEach(card => {
        observer.observe(card);
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to submit forms
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const activeForm = document.activeElement.closest('form');
            if (activeForm) {
                activeForm.submit();
            }
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                const modal = bootstrap.Modal.getInstance(openModal);
                if (modal) modal.hide();
            }
        }
    });

    // Dark mode toggle (future enhancement)
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    if (prefersDarkScheme.matches) {
        document.body.classList.add('dark-mode');
    }

    // Performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                if (perfData.loadEventEnd - perfData.loadEventStart > 3000) {
                    console.warn('Page load time is slow:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
                }
            }, 0);
        });
    }
});

// Service Worker Registration (future enhancement)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TimerManager };
}
