//
//  RNIndoorAtlasModule.swift
//  DeliveryTrackerExpo
//
//  IndoorAtlas iOS Native Module Bridge
//

import Foundation
import IndoorAtlas
import React

@objc(RNIndoorAtlasModule)
class RNIndoorAtlasModule: RCTEventEmitter {
  
  private var locationManager: IALocationManager?
  private var isInitialized = false
  private var hasListeners = false
  
  override init() {
    super.init()
  }
  
  // MARK: - Required RCTEventEmitter Methods
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  override func supportedEvents() -> [String]! {
    return ["IndoorAtlas:locationChanged", "IndoorAtlas:statusChanged"]
  }
  
  override func startObserving() {
    hasListeners = true
  }
  
  override func stopObserving() {
    hasListeners = false
  }
  
  // MARK: - IndoorAtlas Methods
  
  @objc
  func initialize(_ apiKey: String, apiSecret: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        rejecter("ERROR", "Module deallocated", nil)
        return
      }
      
      do {
        // Initialize IndoorAtlas with API credentials
        self.locationManager = IALocationManager.sharedInstance()
        self.locationManager?.delegate = self
        
        // Set API key and secret
        let config = IALocationManager.sharedInstance()
        config.setApiKey(apiKey, andSecret: apiSecret)
        
        self.isInitialized = true
        resolver(true)
      } catch {
        rejecter("INIT_ERROR", "Failed to initialize IndoorAtlas: \(error.localizedDescription)", error)
      }
    }
  }
  
  @objc
  func getCurrentPosition(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard isInitialized, let locationManager = locationManager else {
      rejecter("NOT_INITIALIZED", "IndoorAtlas not initialized", nil)
      return
    }
    
    // Start location updates if not already started
    DispatchQueue.main.async {
      locationManager.startUpdatingLocation()
    }
    
    // Get the latest location
    if let location = locationManager.location {
      let position = self.createPositionDict(from: location)
      resolver(position)
    } else {
      // No location yet - reject so JS can fall back to GPS
      rejecter("NO_LOCATION", "IndoorAtlas location not available yet, use GPS", nil)
    }
  }
  
  @objc
  func startWatching() {
    guard isInitialized, let locationManager = locationManager else {
      return
    }
    
    DispatchQueue.main.async {
      locationManager.startUpdatingLocation()
    }
  }
  
  @objc
  func stopWatching() {
    guard let locationManager = locationManager else {
      return
    }
    
    DispatchQueue.main.async {
      locationManager.stopUpdatingLocation()
    }
  }
  
  // MARK: - Helper Methods
  
  private func createPositionDict(from location: IALocation) -> [String: Any] {
    var position: [String: Any] = [
      "latitude": location.location?.coordinate.latitude ?? 0,
      "longitude": location.location?.coordinate.longitude ?? 0,
      "accuracy": location.location?.horizontalAccuracy ?? 0,
      "timestamp": location.location?.timestamp.timeIntervalSince1970 ?? 0
    ]
    
    // Add floor level if available
    if location.floor != nil {
      position["floor"] = location.floor?.level ?? 0
    }
    
    // Add bearing if available
    if let heading = location.location?.course, heading >= 0 {
      position["bearing"] = heading
    }
    
    return position
  }
}

// MARK: - IALocationManagerDelegate

extension RNIndoorAtlasModule: IALocationManagerDelegate {
  
  func indoorLocationManager(_ manager: IALocationManager, didUpdateLocations locations: [Any]) {
    guard hasListeners, let location = locations.last as? IALocation else {
      return
    }
    
    let position = createPositionDict(from: location)
    sendEvent(withName: "IndoorAtlas:locationChanged", body: position)
  }
  
  func indoorLocationManager(_ manager: IALocationManager, didFailWithError error: Error) {
    if hasListeners {
      sendEvent(withName: "IndoorAtlas:statusChanged", body: [
        "status": "error",
        "message": error.localizedDescription
      ])
    }
  }
  
  func indoorLocationManager(_ manager: IALocationManager, didEnter region: IARegion) {
    // Handle region enter if needed
  }
  
  func indoorLocationManager(_ manager: IALocationManager, didExit region: IARegion) {
    // Handle region exit if needed
  }
}
