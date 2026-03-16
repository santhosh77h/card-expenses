#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VectorWidgetBridge, NSObject)

RCT_EXTERN_METHOD(writeSharedData:(NSString *)json
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadWidgets:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
