import UIKit
import BackgroundTasks

class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Schedule background refresh on each launch if enabled
        if AppSettings.isBackgroundRefreshEnabled {
            BackgroundTaskService.scheduleNextRun()
        }
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        if AppSettings.isBackgroundRefreshEnabled {
            BackgroundTaskService.scheduleNextRun()
        }
    }
}
