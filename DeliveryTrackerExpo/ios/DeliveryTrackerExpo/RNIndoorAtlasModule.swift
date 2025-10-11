import Foundation
import IndoorAtlas
import React

@objc(RNIndoorAtlasModule)
class RNIndoorAtlasModule: RCTEventEmitter {
  
  private var locationManager: IALocationManager?
  private var isWatching = false
  private var pendingLocationResolver: RCTPromiseResolveBlock?
  private var pendingLocationRejecter: RCTPromiseRejectBlock?
  private var locationTimeout: Timer?
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  override func supportedEvents() -> [String]! {
    return ["IndoorAtlas:locationChanged"]
  }
  
  @objc
  func initialize(_ apiKey: String, apiSecret: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      // Initialize IndoorAtlas location manager
      self.locationManager = IALocationManager.sharedInstance()
      self.locationManager?.setApiKey(apiKey, andSecret: apiSecret)
      self.locationManager?.delegate = self
      
      print("✅ IndoorAtlas iOS SDK initialized with API key: \(apiKey.prefix(8))...")
      resolver(true)
    }
  }
  
  @objc
  func getCurrentPosition(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let manager = locationManager else {
      rejecter("NO_MANAGER", "IndoorAtlas not initialized. Call initialize() first.", nil)
      return
    }
    
    // Store resolver/rejecter for callback
    pendingLocationResolver = resolver
    pendingLocationRejecter = rejecter
    
    // Set timeout for location acquisition (10 seconds)
    locationTimeout?.invalidate()
    locationTimeout = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: false) { [weak self] _ in
      guard let self = self else { return }
      if self.pendingLocationRejecter != nil {
        self.pendingLocationRejecter?("TIMEOUT", "Location acquisition timed out after 10 seconds", nil)
        self.pendingLocationResolver = nil
        self.pendingLocationRejecter = nil
      }
    }
    
    // Start location updates temporarily
    print("📍 Starting IndoorAtlas location update for getCurrentPosition...")
    manager.startUpdatingLocation()
  }
  
  @objc
  func startWatching() {
    guard let manager = locationManager, !isWatching else {
      print("⚠️ IndoorAtlas: startWatching called but manager unavailable or already watching")
      return
    }
    
    isWatching = true
    print("👀 Starting IndoorAtlas continuous location watching...")
    manager.startUpdatingLocation()
  }
  
  @objc
  func stopWatching() {
    guard let manager = locationManager else {
      print("⚠️ IndoorAtlas: stopWatching called but manager unavailable")
      return
    }
    
    isWatching = false
    print("🛑 Stopping IndoorAtlas location watching...")
    manager.stopUpdatingLocation()
  }
}

// MARK: - IALocationManagerDelegate
extension RNIndoorAtlasModule: IALocationManagerDelegate {
  
  func indoorLocationManager(_ manager: IALocationManager, didUpdateLocations locations: [Any]) {
    guard let location = locations.last as? IALocation else {
      print("⚠️ IndoorAtlas: Received invalid location object")
      return
    }
    
    guard let coordinate = location.location?.coordinate else {
      print("⚠️ IndoorAtlas: Location has no valid coordinate")
      return
    }
    
    let accuracy = location.location?.horizontalAccuracy ?? 999.0
    let floorLevel = location.floor?.level
    let timestamp = Date().timeIntervalSince1970 * 1000 // milliseconds
    let bearing = location.location?.course ?? -1
    
    let locationData: [String: Any] = [
      "latitude": coordinate.latitude,
      "longitude": coordinate.longitude,
      "accuracy": accuracy,
      "floor": floorLevel as Any,
      "timestamp": timestamp,
      "bearing": bearing >= 0 ? bearing : NSNull()
    ]
    
    print("📍 IndoorAtlas location update: lat=\(coordinate.latitude), lon=\(coordinate.longitude), accuracy=\(accuracy)m, floor=\(floorLevel?.description ?? "nil")")
    
    // If there's a pending promise (from getCurrentPosition), resolve it
    if let resolver = pendingLocationResolver {
      locationTimeout?.invalidate()
      resolver(locationData)
      pendingLocationResolver = nil
      pendingLocationRejecter = nil
      
      // Stop updating if not in continuous watch mode
      if !isWatching {
        manager.stopUpdatingLocation()
      }
    }
    
    // Always send event for continuous watching
    if isWatching {
      sendEvent(withName: "IndoorAtlas:locationChanged", body: locationData)
    }
  }
  
  func indoorLocationManager(_ manager: IALocationManager, didFailWithError error: Error) {
    print("❌ IndoorAtlas location error: \(error.localizedDescription)")
    
    // If there's a pending promise, reject it
    if let rejecter = pendingLocationRejecter {
      locationTimeout?.invalidate()
      rejecter("LOCATION_ERROR", error.localizedDescription, error)
      pendingLocationResolver = nil
      pendingLocationRejecter = nil
    }
  }
}

