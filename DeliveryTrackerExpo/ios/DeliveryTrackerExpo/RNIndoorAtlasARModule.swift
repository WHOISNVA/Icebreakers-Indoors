//
//  RNIndoorAtlasARModule.swift
//  DeliveryTrackerExpo
//
//  IndoorAtlas AR Wayfinding Native Module
//

import Foundation
import IndoorAtlas
import React
import UIKit

@objc(RNIndoorAtlasARModule)
class RNIndoorAtlasARModule: NSObject {
  
  private var locationManager: IALocationManager?
  private var arViewController: UIViewController?
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  // MARK: - AR Wayfinding
  
  @objc
  func startARWayfinding(_ targetLat: Double, targetLng: Double, targetFloor: NSNumber?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        rejecter("ERROR", "Module deallocated", nil)
        return
      }
      
      // Get the location manager (already initialized by RNIndoorAtlasModule)
      self.locationManager = IALocationManager.sharedInstance()
      
      // IndoorAtlas SDK 3.x doesn't have a direct wayfinding API
      // The positioning is already handled by RNIndoorAtlasModule
      // This method just signals that AR mode is active with a target
      
      // Log the target for debugging
      NSLog("🎯 IndoorAtlas AR: Target set to (\(targetLat), \(targetLng)) floor: \(targetFloor?.intValue ?? -1)")
      
      // Signal success - positioning is already active via RNIndoorAtlasModule
      resolver(true)
    }
  }
  
  @objc
  func stopARWayfinding(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      // AR mode stopped - positioning continues via RNIndoorAtlasModule
      NSLog("🛑 IndoorAtlas AR: Stopped")
      resolver(true)
    }
  }
}

