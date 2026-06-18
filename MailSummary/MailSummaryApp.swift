import SwiftUI

@main
struct MailSummaryApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        BackgroundTaskService.registerTasks()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
