//
//  RNIndoorAtlasModule.m
//  DeliveryTrackerExpo
//
//  Objective-C Bridge for IndoorAtlas Swift Module
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RNIndoorAtlasModule, RCTEventEmitter)

RCT_EXTERN_METHOD(initialize:(NSString *)apiKey
                  apiSecret:(NSString *)apiSecret
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCurrentPosition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startWatching)

RCT_EXTERN_METHOD(stopWatching)

@end
