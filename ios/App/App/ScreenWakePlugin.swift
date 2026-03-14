import Capacitor
import UIKit

@objc(ScreenWakePlugin)
public class ScreenWakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenWakePlugin"
    public let jsName = "ScreenWake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)
    ]
    private var observers: [NSObjectProtocol] = []

    override public func load() {
        observers.append(NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            UIApplication.shared.isIdleTimerDisabled = false
        })
        observers.append(NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            UIApplication.shared.isIdleTimerDisabled = false
        })
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled", false)
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = enabled
            call.resolve([
                "enabled": UIApplication.shared.isIdleTimerDisabled
            ])
        }
    }
}
