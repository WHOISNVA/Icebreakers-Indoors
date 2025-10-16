package com.anonymous.DeliveryTrackerExpo

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.indooratlas.android.sdk.*
import android.os.Bundle

class IndoorAtlasModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var locationManager: IALocationManager? = null
    private var locationRequest: IALocationRequest? = null
    private var locationListener: IALocationListener? = null
    private var wayfindingRequest: IAWayfindingRequest? = null
    private var isWatching = false
    private var isWayfindingActive = false
    
    override fun getName(): String {
        return "RNIndoorAtlasModule"
    }
    
    @ReactMethod
    fun initialize(apiKey: String, apiSecret: String, promise: Promise) {
        // IndoorAtlas SDK must be initialized on the main thread
        reactApplicationContext.runOnUiQueueThread {
            try {
                // Initialize IndoorAtlas with API credentials
                locationManager = IALocationManager.create(reactApplicationContext)
                
                // Set API credentials via Bundle
                val extras = Bundle()
                extras.putString(IALocationManager.EXTRA_API_KEY, apiKey)
                extras.putString(IALocationManager.EXTRA_API_SECRET, apiSecret)
                
                locationRequest = IALocationRequest.create()
                locationRequest?.fastestInterval = 1000L // 1 second
                locationRequest?.priority = IALocationRequest.PRIORITY_HIGH_ACCURACY
                
                println("✅ IndoorAtlas Android SDK initialized with API key: ${apiKey.take(8)}...")
                promise.resolve(true)
            } catch (e: Exception) {
                println("❌ IndoorAtlas initialization failed: ${e.message}")
                promise.reject("INIT_ERROR", "Failed to initialize IndoorAtlas: ${e.message}", e)
            }
        }
    }
    
    @ReactMethod
    fun getCurrentPosition(promise: Promise) {
        if (locationManager == null) {
            promise.reject("NOT_INITIALIZED", "IndoorAtlas not initialized")
            return
        }
        
        // IndoorAtlas SDK must be called from the main thread
        reactApplicationContext.runOnUiQueueThread {
            try {
                val singleLocationListener = object : IALocationListener {
                    override fun onLocationChanged(location: IALocation) {
                        val position = Arguments.createMap()
                        position.putDouble("latitude", location.latitude)
                        position.putDouble("longitude", location.longitude)
                        position.putDouble("accuracy", location.accuracy.toDouble())
                        
                        // Floor level (may be null)
                        if (location.hasFloorLevel()) {
                            position.putInt("floor", location.floorLevel)
                        } else {
                            position.putNull("floor")
                        }
                        
                        // Altitude (check if value is valid)
                        val altitude = location.altitude
                        if (altitude != 0.0) {
                            position.putDouble("altitude", altitude)
                        } else {
                            position.putNull("altitude")
                        }
                        
                        // Bearing (check if value is valid)
                        val bearing = location.bearing
                        if (bearing != 0.0f) {
                            position.putDouble("bearing", bearing.toDouble())
                        } else {
                            position.putNull("bearing")
                        }
                        
                        position.putDouble("timestamp", location.time.toDouble())
                        
                        println("📍 IndoorAtlas location update: lat=${location.latitude}, lng=${location.longitude}, accuracy=${location.accuracy}m")
                        
                        promise.resolve(position)
                        locationManager?.removeLocationUpdates(this)
                    }
                    
                    override fun onStatusChanged(provider: String, status: Int, extras: Bundle?) {
                        // Handle status changes if needed
                    }
                }
                
                locationRequest?.let { request ->
                    locationManager?.requestLocationUpdates(request, singleLocationListener)
                }
            } catch (e: Exception) {
                promise.reject("LOCATION_ERROR", "Failed to get location: ${e.message}", e)
            }
        }
    }
    
    @ReactMethod
    fun startWatching() {
        if (locationManager == null || isWatching) {
            return
        }
        
        // IndoorAtlas SDK must be called from the main thread
        reactApplicationContext.runOnUiQueueThread {
            isWatching = true
            
            locationListener = object : IALocationListener {
                override fun onLocationChanged(location: IALocation) {
                    val position = Arguments.createMap()
                    position.putDouble("latitude", location.latitude)
                    position.putDouble("longitude", location.longitude)
                    position.putDouble("accuracy", location.accuracy.toDouble())
                    
                    // Floor level (may be null)
                    if (location.hasFloorLevel()) {
                        position.putInt("floor", location.floorLevel)
                    } else {
                        position.putNull("floor")
                    }
                    
                    // Altitude (check if value is valid)
                    val altitude = location.altitude
                    if (altitude != 0.0) {
                        position.putDouble("altitude", altitude)
                    } else {
                        position.putNull("altitude")
                    }
                    
                    // Bearing/Heading from IndoorAtlas (much more accurate than magnetometer indoors)
                    val bearing = location.bearing
                    if (bearing != 0.0f) {
                        position.putDouble("bearing", bearing.toDouble())
                        position.putDouble("heading", bearing.toDouble()) // Add heading alias
                    } else {
                        position.putNull("bearing")
                        position.putNull("heading")
                    }
                    
                    // Orientation accuracy (bearing is the orientation in IndoorAtlas)
                    if (bearing != 0.0f) {
                        position.putDouble("orientation", bearing.toDouble())
                        position.putBoolean("hasOrientation", true)
                    } else {
                        position.putBoolean("hasOrientation", false)
                    }
                    
                    position.putDouble("timestamp", location.time.toDouble())
                    
                    sendEvent("IndoorAtlas:locationChanged", position)
                }
                
                override fun onStatusChanged(provider: String, status: Int, extras: Bundle?) {
                    // Send status updates to React Native
                    val statusData = Arguments.createMap()
                    statusData.putString("provider", provider)
                    statusData.putInt("status", status)
                    
                    when (status) {
                        IALocationManager.STATUS_OUT_OF_SERVICE -> {
                            statusData.putString("statusText", "OUT_OF_SERVICE")
                        }
                        IALocationManager.STATUS_TEMPORARILY_UNAVAILABLE -> {
                            statusData.putString("statusText", "TEMPORARILY_UNAVAILABLE")
                        }
                        IALocationManager.STATUS_AVAILABLE -> {
                            statusData.putString("statusText", "AVAILABLE")
                        }
                    }
                    
                    sendEvent("IndoorAtlas:statusChanged", statusData)
                }
            }
            
            locationRequest?.let { request ->
                locationListener?.let { listener ->
                    locationManager?.requestLocationUpdates(request, listener)
                }
            }
            
            println("✅ IndoorAtlas location watching started")
        }
    }
    
    @ReactMethod
    fun stopWatching() {
        if (locationManager == null || !isWatching) {
            return
        }
        
        // IndoorAtlas SDK must be called from the main thread
        reactApplicationContext.runOnUiQueueThread {
            locationListener?.let {
                locationManager?.removeLocationUpdates(it)
            }
            locationListener = null
            isWatching = false
            
            println("🛑 IndoorAtlas location watching stopped")
        }
    }
    
    @ReactMethod
    fun requestWayfinding(targetLat: Double, targetLng: Double, targetFloor: Int?, promise: Promise) {
        if (locationManager == null) {
            promise.reject("NOT_INITIALIZED", "IndoorAtlas not initialized")
            return
        }
        
        // IndoorAtlas SDK must be called from the main thread
        reactApplicationContext.runOnUiQueueThread {
            try {
                // Build wayfinding request
                val builder = IAWayfindingRequest.Builder()
                    .withLatitude(targetLat)
                    .withLongitude(targetLng)
                
                // Add floor if provided
                targetFloor?.let {
                    builder.withFloor(it)
                }
                
                wayfindingRequest = builder.build()
                
                // Create wayfinding listener for route updates
                val wayfindingListener = object : IAWayfindingListener {
                    override fun onWayfindingUpdate(route: IARoute) {
                        try {
                            val routeData = Arguments.createMap()
                            val waypoints = Arguments.createArray()
                            var totalLength = 0.0
                            
                            // Process all route legs (segments between waypoints)
                            // IARoute.legs is an array of IARouteLeg objects
                            val legs = route.legs
                            for (i in 0 until legs.size) {
                                val leg = legs[i]
                                
                                // Get begin and end IARoutePoint
                                val beginPoint = leg.begin
                                val endPoint = leg.end
                                
                                // Add begin point
                                val beginWaypoint = Arguments.createMap()
                                beginWaypoint.putDouble("latitude", beginPoint.latitude)
                                beginWaypoint.putDouble("longitude", beginPoint.longitude)
                                try {
                                    // Try to get floor level if available
                                    val floor = beginPoint.floor
                                    if (floor != null) {
                                        beginWaypoint.putInt("floor", floor)
                                    }
                                } catch (e: Exception) {
                                    // Floor not available
                                }
                                waypoints.pushMap(beginWaypoint)
                                
                                // Add end point (avoid duplicates except at end)
                                if (i == legs.size - 1) {
                                    val endWaypoint = Arguments.createMap()
                                    endWaypoint.putDouble("latitude", endPoint.latitude)
                                    endWaypoint.putDouble("longitude", endPoint.longitude)
                                    try {
                                        val floor = endPoint.floor
                                        if (floor != null) {
                                            endWaypoint.putInt("floor", floor)
                                        }
                                    } catch (e: Exception) {
                                        // Floor not available
                                    }
                                    waypoints.pushMap(endWaypoint)
                                }
                                
                                totalLength += leg.length
                            }
                            
                            routeData.putArray("waypoints", waypoints)
                            routeData.putDouble("length", totalLength)
                            
                            sendEvent("IndoorAtlas:wayfindingUpdate", routeData)
                            println("🗺️ Wayfinding route updated: ${legs.size} legs, ${totalLength}m total, ${waypoints.size()} waypoints")
                        } catch (e: Exception) {
                            println("❌ Error processing wayfinding route: ${e.message}")
                            e.printStackTrace()
                        }
                    }
                }
                
                // Request wayfinding updates
                wayfindingRequest?.let { request ->
                    locationManager?.requestWayfindingUpdates(request, wayfindingListener)
                    isWayfindingActive = true
                    println("🎯 Wayfinding requested to: lat=$targetLat, lng=$targetLng, floor=$targetFloor")
                    promise.resolve(true)
                } ?: run {
                    promise.reject("WAYFINDING_ERROR", "Failed to create wayfinding request")
                }
            } catch (e: Exception) {
                println("❌ Wayfinding request failed: ${e.message}")
                e.printStackTrace()
                promise.reject("WAYFINDING_ERROR", "Failed to request wayfinding: ${e.message}", e)
            }
        }
    }
    
    @ReactMethod
    fun removeWayfinding(promise: Promise) {
        if (locationManager == null) {
            promise.resolve(false)
            return
        }
        
        // IndoorAtlas SDK must be called from the main thread
        reactApplicationContext.runOnUiQueueThread {
            try {
                if (isWayfindingActive) {
                    locationManager?.removeWayfindingUpdates()
                    wayfindingRequest = null
                    isWayfindingActive = false
                    println("🛑 Wayfinding removed")
                    promise.resolve(true)
                } else {
                    promise.resolve(false)
                }
            } catch (e: Exception) {
                println("❌ Failed to remove wayfinding: ${e.message}")
                promise.reject("WAYFINDING_ERROR", "Failed to remove wayfinding: ${e.message}", e)
            }
        }
    }
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}


