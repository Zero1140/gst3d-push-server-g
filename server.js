const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const admin = require('firebase-admin');
const http = require('http');

// Configurar Firebase Admin
// Intentar cargar desde múltiples ubicaciones (desarrollo local y Render)
let serviceAccount;
try {
  serviceAccount = require('./firebase-service-account.json');
} catch (err) {
  console.log('Intentando cargar desde ruta de Render...');
  serviceAccount = require('/opt/render/project/src/firebase-service-account.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'gst3dapp'
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS - Configuración completa
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Almacenamiento en memoria de tokens
let registeredTokens = [];
let tokenLogs = [];

// Función para detectar país por IP
async function getCountryByIP(ip) {
  try {
    // Obtener IP real (Render puede pasar IPs a través de proxy)
    let realIP = ip;
    
    // ip-api.com es gratis y no requiere API key
    const data = await new Promise((resolve) => {
      http.get(`http://ip-api.com/json/${realIP}?fields=status,country,countryCode,region,regionName,city,lat,lon`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ status: 'fail' });
          }
        });
      }).on('error', () => resolve({ status: 'fail' }));
    });
    
    if (data.status === 'success') {
      console.log('🌍 [IP] País detectado:', data.countryCode, '-', data.country);
      console.log('📍 [IP] Ciudad:', data.city, ', Región:', data.regionName);
      return {
        country: data.countryCode,
        countryName: data.country,
        region: data.regionName,
        city: data.city,
        latitude: data.lat,
        longitude: data.lon
      };
    } else {
      console.log('⚠️ [IP] No se pudo detectar ubicación');
      return null;
    }
  } catch (error) {
    console.error('❌ [IP] Error detectando ubicación:', error.message);
    return null;
  }
}

// Middleware de autenticación
const bearerTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const validTokens = [
      '31W99vbPAlSZPYPYTLKPHJyT1MKwHVi4y8Z1jtmwOPze9dcv4PLYte7AdRxJDaGV',
      process.env.BEARER_TOKEN,
      process.env.TEMPORARY_TOKEN
    ].filter(Boolean);

    if (validTokens.includes(token)) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
  } else {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
};

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    tokens: registeredTokens.length
  });
});

// Endpoint de estado (alias para compatibilidad)
app.get('/api/status', bearerTokenMiddleware, (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    registeredTokens: registeredTokens.length,
    server: 'GST3D Push Server',
    version: '1.1-auto-token',
    platform: 'Node.js'
  });
});

// Registrar token FCM
app.post('/api/push/token', bearerTokenMiddleware, async (req, res) => {
  console.log('══════════════════════════════════════════════════');
  console.log('🚀 [SERVER] ===== TOKEN REGISTRATION REQUEST =====');
  console.log('══════════════════════════════════════════════════');
  console.log('📍 IP:', req.ip || req.connection.remoteAddress);
  console.log('🌐 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body recibido:', JSON.stringify(req.body, null, 2));
  
  try {
    const { token, platform, timestamp, source, customerId, email } = req.body;

    console.log('📱 [SERVER] Parsed data:', {
      token: token ? token.substring(0, 20) + '...' : 'missing',
      platform,
      source,
      customerId,
      email,
      timestamp: new Date().toISOString()
    });

    // Validar datos requeridos
    if (!token) {
      return res.status(400).json({
        status: 400,
        error: 'Missing required field: token'
      });
    }

    // Detectar país por IP
    const clientIP = req.ip || req.connection.remoteAddress;
    const locationData = await getCountryByIP(clientIP);

    // Verificar si el token ya existe
    const existingTokenIndex = registeredTokens.findIndex(t => t.token === token);
    
    const tokenData = {
      token,
      platform: platform || 'android',
      timestamp: timestamp || new Date().toISOString(),
      source: source || 'unknown',
      customerId: customerId || null,
      email: email || null,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      // Agregar datos de ubicación
      ...(locationData || {}),
      ip: clientIP
    };

    if (existingTokenIndex !== -1) {
      // Actualizar token existente
      registeredTokens[existingTokenIndex] = {
        ...registeredTokens[existingTokenIndex],
        ...tokenData,
        lastSeen: new Date().toISOString()
      };
      console.log('🔄 [SERVER] Token updated:', token.substring(0, 20) + '...');
    } else {
      // Agregar nuevo token
      registeredTokens.push(tokenData);
      console.log('✅ [SERVER] New token registered:', token.substring(0, 20) + '...');
    }

    // Agregar a logs
    tokenLogs.push({
      action: existingTokenIndex !== -1 ? 'updated' : 'registered',
      token: token.substring(0, 20) + '...',
      platform,
      timestamp: new Date().toISOString()
    });

    // Mantener solo los últimos 100 logs
    if (tokenLogs.length > 100) {
      tokenLogs = tokenLogs.slice(-100);
    }

    res.status(200).json({
      status: 200,
      message: 'Token registered successfully',
      data: {
        token: token.substring(0, 20) + '...',
        platform: tokenData.platform,
        registeredAt: tokenData.registeredAt,
        country: locationData?.country || 'UNKNOWN',
        countryName: locationData?.countryName || 'Unknown',
        city: locationData?.city || 'Unknown'
      }
    });

  } catch (error) {
    console.error('❌ [SERVER] Error registering token:', error);
    res.status(500).json({
      status: 500,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Obtener tokens registrados
app.get('/api/push/tokens', bearerTokenMiddleware, (req, res) => {
  try {
    console.log('📋 [SERVER] Tokens request received');
    
    const tokens = registeredTokens.map(t => t.token);
    
    res.json({
      status: 200,
      count: tokens.length,
      tokens: tokens,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SERVER] Error getting tokens:', error);
    res.status(500).json({
      status: 500,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Obtener información detallada de tokens
app.get('/api/push/tokens/info', bearerTokenMiddleware, (req, res) => {
  try {
    console.log('📊 [SERVER] Token info request received');
    
    res.json({
      status: 200,
      count: registeredTokens.length,
      tokens: registeredTokens.map(t => ({
        token: t.token.substring(0, 20) + '...',
        platform: t.platform,
        source: t.source,
        customerId: t.customerId,
        email: t.email,
        registeredAt: t.registeredAt,
        lastSeen: t.lastSeen
      })),
      logs: tokenLogs.slice(-10), // Últimos 10 logs
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SERVER] Error getting token info:', error);
    res.status(500).json({
      status: 500,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Enviar notificación a todos los tokens
app.post('/api/push/send', bearerTokenMiddleware, async (req, res) => {
  try {
    const { title, body, data } = req.body;

    console.log('📨 [SERVER] Send notification request:', {
      title,
      body,
      tokenCount: registeredTokens.length,
      timestamp: new Date().toISOString()
    });

    if (!title || !body) {
      return res.status(400).json({
        status: 400,
        error: 'Missing required fields: title, body'
      });
    }

    if (registeredTokens.length === 0) {
      return res.status(404).json({
        status: 404,
        error: 'No tokens registered',
        message: 'No devices have registered their FCM tokens yet'
      });
    }

    const results = [];
    const errors = [];

    // Enviar a cada token registrado
    for (const tokenData of registeredTokens) {
      try {
        const message = {
          notification: {
            title,
            body
          },
          data: {
            ...data,
            timestamp: new Date().toISOString(),
            source: 'push_server'
          },
          token: tokenData.token
        };

        const response = await admin.messaging().send(message);
        results.push({
          token: tokenData.token.substring(0, 20) + '...',
          platform: tokenData.platform,
          messageId: response,
          success: true
        });

        console.log('✅ [SERVER] Notification sent to:', tokenData.token.substring(0, 20) + '...');

      } catch (error) {
        errors.push({
          token: tokenData.token.substring(0, 20) + '...',
          platform: tokenData.platform,
          error: error.message,
          success: false
        });

        console.log('❌ [SERVER] Notification failed for:', tokenData.token.substring(0, 20) + '...', error.message);

        // Si el token es inválido, marcarlo para eliminación
        if (error.code === 'messaging/invalid-registration-token') {
          tokenData.markForDeletion = true;
        }
      }
    }

    // Limpiar tokens inválidos
    const beforeCount = registeredTokens.length;
    registeredTokens = registeredTokens.filter(t => !t.markForDeletion);
    const removedCount = beforeCount - registeredTokens.length;

    if (removedCount > 0) {
      console.log(`🧹 [SERVER] Removed ${removedCount} invalid tokens`);
    }

    res.json({
      status: 200,
      message: 'Notification sending completed',
      summary: {
        totalTokens: beforeCount,
        successful: results.length,
        failed: errors.length,
        removed: removedCount
      },
      results,
      errors
    });

  } catch (error) {
    console.error('❌ [SERVER] Error sending notifications:', error);
    res.status(500).json({
      status: 500,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Obtener logs del servidor
app.get('/api/logs', bearerTokenMiddleware, (req, res) => {
  try {
    res.json({
      status: 200,
      logs: tokenLogs.slice(-20), // Últimos 20 logs
      totalLogs: tokenLogs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Push server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// NUEVO ENDPOINT: Prueba completa de notificaciones
app.post('/api/push/test', bearerTokenMiddleware, async (req, res) => {
  try {
    const { testType = 'complete' } = req.body;

    console.log('🧪 [SERVER] Test notification request:', {
      testType,
      timestamp: new Date().toISOString()
    });

    if (registeredTokens.length === 0) {
      return res.status(404).json({
        status: 404,
        error: 'No tokens registered',
        message: 'No devices have registered their FCM tokens yet. Please register at least one token first.',
        hint: 'Use POST /api/push/token to register a device token'
      });
    }

    const results = [];
    const errors = [];
    
    let testNotification = {};

    // Definir diferentes tipos de pruebas
    switch (testType) {
      case 'simple':
        testNotification = {
          notification: {
            title: '🧪 Test Simple',
            body: 'Notificación de prueba simple desde API 22'
          },
          data: {
            testType: 'simple',
            timestamp: new Date().toISOString()
          }
        };
        break;

      case 'compatibility':
        testNotification = {
          notification: {
            title: '🔧 Test Compatibilidad Android 5.1',
            body: 'Probando compatibilidad con Android API 22 (5.1 Lollipop)',
            sound: 'default',
            priority: 'high'
          },
          data: {
            testType: 'compatibility',
            androidVersion: 'API 22',
            timestamp: new Date().toISOString(),
            features: 'Firebase FCM + Wake Lock + Foreground Service'
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'test_channel',
              sound: 'default',
              priority: 'high'
            }
          }
        };
        break;

      case 'firebase':
        testNotification = {
          notification: {
            title: '🔥 Test Firebase FCM',
            body: 'Probando Firebase Cloud Messaging en Android 5.1+',
            sound: 'default'
          },
          data: {
            testType: 'firebase',
            firebaseVersion: '21.2.0',
            timestamp: new Date().toISOString()
          }
        };
        break;

      default: // 'complete'
        testNotification = {
          notification: {
            title: '✅ Test Completo - API 22',
            body: 'Prueba completa de notificaciones para Android 5.1 Lollipop - ' + new Date().toLocaleTimeString(),
            sound: 'default',
            priority: 'high'
          },
          data: {
            testType: 'complete',
            androidVersion: 'API 22 (Android 5.1)',
            reactNativeVersion: '0.75.4',
            firebaseVersion: '21.2.0',
            timestamp: new Date().toISOString(),
            features: [
              'Firebase FCM',
              'Wake Lock',
              'Foreground Service',
              'Notification Channels (8.0+)',
              'Battery Optimization Bypass'
            ].join(', ')
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'default_channel',
              sound: 'default',
              priority: 'high',
              clickAction: 'OPEN_APP'
            }
          }
        };
        break;
    }

    // Enviar notificación a todos los tokens
    for (const tokenData of registeredTokens) {
      try {
        const message = {
          ...testNotification,
          token: tokenData.token
        };

        const response = await admin.messaging().send(message);
        
        results.push({
          token: tokenData.token.substring(0, 20) + '...',
          platform: tokenData.platform,
          messageId: response,
          success: true,
          testType
        });

        console.log('✅ [SERVER] Test notification sent to:', tokenData.token.substring(0, 20) + '...');

      } catch (error) {
        errors.push({
          token: tokenData.token.substring(0, 20) + '...',
          platform: tokenData.platform,
          error: error.message,
          code: error.code,
          success: false,
          testType
        });

        console.log('❌ [SERVER] Test notification failed for:', tokenData.token.substring(0, 20) + '...', error.message);

        if (error.code === 'messaging/invalid-registration-token') {
          tokenData.markForDeletion = true;
        }
      }
    }

    // Limpiar tokens inválidos
    const beforeCount = registeredTokens.length;
    registeredTokens = registeredTokens.filter(t => !t.markForDeletion);
    const removedCount = beforeCount - registeredTokens.length;

    if (removedCount > 0) {
      console.log(`🧹 [SERVER] Removed ${removedCount} invalid tokens during test`);
    }

    res.json({
      status: 200,
      message: 'Test notification completed',
      testType,
      summary: {
        totalTokens: beforeCount,
        successful: results.length,
        failed: errors.length,
        removed: removedCount
      },
      androidCompatibility: {
        minSdkVersion: 22,
        minAndroidVersion: '5.1 Lollipop',
        marketCoverage: '94% of Android devices',
        features: [
          'Firebase FCM supported',
          'Wake Lock supported',
          'Foreground Service supported',
          'Notification Channels (Android 8.0+)',
          'Runtime Permissions (Android 6.0+)'
        ]
      },
      results,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SERVER] Error in test notification:', error);
    res.status(500).json({
      status: 500,
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Manejar rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/test',
      'POST /api/push/token',
      'GET /api/push/tokens',
      'GET /api/push/tokens/info',
      'POST /api/push/send',
      'POST /api/push/test',
      'GET /api/logs'
    ]
  });
});

// Iniciar servidor
app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ [SERVER] Error starting server:', err);
    throw err;
  }

  console.log('🚀 [SERVER] Push server started successfully!');
  console.log(`📡 [SERVER] Server running on port ${port}`);
  console.log(`🌐 [SERVER] Accessible at: http://localhost:${port}`);
  console.log(`🔗 [SERVER] Health check: http://localhost:${port}/health`);
  console.log(`📱 [SERVER] Token endpoint: http://localhost:${port}/api/push/token`);
  console.log(`📨 [SERVER] Send endpoint: http://localhost:${port}/api/push/send`);
  console.log(`🧪 [SERVER] Test endpoint: http://localhost:${port}/api/push/test`);
  console.log('✅ [SERVER] Firebase Admin SDK initialized');
  console.log('🔐 [SERVER] Bearer token authentication enabled');
  console.log('📊 [SERVER] Ready to receive FCM tokens and send notifications');
  console.log('📱 [SERVER] Android compatibility: API 22 (Android 5.1 Lollipop)');
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ [SERVER] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});
