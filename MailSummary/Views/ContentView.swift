import SwiftUI

struct ContentView: View {
    @StateObject private var mainVM  = MainViewModel()
    @StateObject private var configVM = ConfigurationViewModel()

    var body: some View {
        TabView {
            DashboardView()
                .environmentObject(mainVM)
                .tabItem {
                    Label("Resumen", systemImage: "envelope.badge")
                }

            HistoryView()
                .environmentObject(mainVM)
                .tabItem {
                    Label("Historial", systemImage: "clock.arrow.circlepath")
                }

            ConfigurationView()
                .environmentObject(configVM)
                .tabItem {
                    Label("Configuración", systemImage: "gear")
                }
        }
    }
}
