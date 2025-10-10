//
//  RNIndoorAtlasARModule.m
//  DeliveryTrackerExpo
//
//  Objective-C Bridge for IndoorAtlas AR Module
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RNIndoorAtlasARModule, NSObject)

RCT_EXTERN_METHOD(startARWayfinding:(double)targetLat
                  targetLng:(double)targetLng
                  targetFloor:(NSNumber *)targetFloor
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopARWayfinding:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

