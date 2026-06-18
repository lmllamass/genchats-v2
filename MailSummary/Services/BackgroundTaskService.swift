import BackgroundTasks
import Foundation

// Background task identifier — must match Info.plist BGTaskSchedulerPermittedIdentifiers
let kBGTaskIdentifier = "com.mailsummary.daily-email-summary"

struct BackgroundTaskService {

    // MARK: - Registration (call from App init, before app becomes active)

    static func registerTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: kBGTaskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            handleAppRefresh(task: refreshTask)
        }
    }

    // MARK: - Schedule

    static func scheduleNextRun() {
        let request = BGAppRefreshTaskRequest(identifier: kBGTaskIdentifier)

        var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        components.hour   = AppSettings.scheduledHour
        components.minute = AppSettings.scheduledMinute

        var target = Calendar.current.date(from: components) ?? Date()
        // If time already passed today, schedule for tomorrow
        if target <= Date() {
            target = Calendar.current.date(byAdding: .day, value: 1, to: target) ?? target
        }
        request.earliestBeginDate = target

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[BGTask] Schedule error: \(error.localizedDescription)")
        }
    }

    static func cancelAll() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: kBGTaskIdentifier)
    }

    // MARK: - Handler

    private static func handleAppRefresh(task: BGAppRefreshTask) {
        // Re-schedule the next run before doing work
        scheduleNextRun()

        let processingTask = Task {
            do {
                let mainVM = await MainViewModel()
                try await mainVM.runSummaryPipeline()
                task.setTaskCompleted(success: true)
            } catch {
                print("[BGTask] Error: \(error.localizedDescription)")
                task.setTaskCompleted(success: false)
            }
        }

        task.expirationHandler = {
            processingTask.cancel()
            task.setTaskCompleted(success: false)
        }
    }
}
