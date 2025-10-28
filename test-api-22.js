/**
 * Script de prueba para el nuevo endpoint /api/push/test
 * Prueba notificaciones para Android API 22 (Android 5.1 Lollipop)
 */

const https = require('https');
const http = require('http');

const BEARER_TOKEN = '31W99vbPAlSZPYPYTLKPHJyT1MKwHVi4y8Z1jtmwOPze9dcv4PLYte7AdRxJDaGV';
const SERVER_URL = 'http://localhost:3000';

// Colores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función auxiliar para hacer requests
function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SERVER_URL);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testServer() {
  log('\n🧪 =====================================', 'cyan');
  log('🧪 TEST DE API ANDROID API 22', 'bright');
  log('🧪 =====================================\n', 'cyan');

  try {
    // 1. Verificar salud del servidor
    log('📡 Paso 1: Verificando servidor...', 'blue');
    const health = await makeRequest('GET', '/health');
    log(`   Estado: ${health.data.status}`, health.data.status === 'OK' ? 'green' : 'red');
    log(`   Tokens registrados: ${health.data.tokens}`, 'yellow');
    console.log('');

    // 2. Verificar tokens disponibles
    log('📋 Paso 2: Verificando tokens registrados...', 'blue');
    const tokensInfo = await makeRequest('GET', '/api/push/tokens/info');
    
    if (tokensInfo.data.count === 0) {
      log('   ⚠️ No hay tokens registrados', 'yellow');
      log('   💡 Por favor registra un token con la app primero', 'cyan');
      log('\n   Para registrar un token, abre la app en tu dispositivo Android', 'bright');
      return;
    }

    log(`   ✅ Se encontraron ${tokensInfo.data.count} tokens registrados`, 'green');
    console.log('');

    // 3. Test Simple
    log('🧪 Paso 3: Enviando test simple...', 'blue');
    const simpleTest = await makeRequest('POST', '/api/push/test', { testType: 'simple' });
    
    if (simpleTest.data.successful > 0) {
      log(`   ✅ Test simple enviado: ${simpleTest.data.successful} exitoso`, 'green');
    } else {
      log(`   ⚠️ Test simple: ${simpleTest.data.failed} fallidos`, 'yellow');
    }
    
    console.log('\n   Esperando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('');

    // 4. Test de Compatibilidad
    log('🧪 Paso 4: Enviando test de compatibilidad...', 'blue');
    const compatTest = await makeRequest('POST', '/api/push/test', { testType: 'compatibility' });
    
    if (compatTest.data.successful > 0) {
      log(`   ✅ Test de compatibilidad enviado: ${compatTest.data.successful} exitoso`, 'green');
      log(`   📱 Min SDK Version: ${compatTest.data.androidCompatibility.minSdkVersion}`, 'cyan');
      log(`   📱 Cobertura de mercado: ${compatTest.data.androidCompatibility.marketCoverage}`, 'cyan');
    } else {
      log(`   ⚠️ Test de compatibilidad: ${compatTest.data.failed} fallidos`, 'yellow');
    }
    
    console.log('\n   Esperando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('');

    // 5. Test Firebase
    log('🧪 Paso 5: Enviando test de Firebase...', 'blue');
    const firebaseTest = await makeRequest('POST', '/api/push/test', { testType: 'firebase' });
    
    if (firebaseTest.data.successful > 0) {
      log(`   ✅ Test de Firebase enviado: ${firebaseTest.data.successful} exitoso`, 'green');
    } else {
      log(`   ⚠️ Test de Firebase: ${firebaseTest.data.failed} fallidos`, 'yellow');
    }
    
    console.log('\n   Esperando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('');

    // 6. Test Completo
    log('🧪 Paso 6: Enviando test completo...', 'blue');
    const completeTest = await makeRequest('POST', '/api/push/test', { testType: 'complete' });
    
    if (completeTest.status === 200) {
      log(`   ✅ Test completo enviado: ${completeTest.data.successful} exitoso`, 'green');
      log(`   ⚠️ Fallos: ${completeTest.data.failed}`, completeTest.data.failed > 0 ? 'yellow' : 'green');
      
      log('\n   📊 Resumen de compatibilidad:', 'bright');
      log(`   - Min SDK: ${completeTest.data.androidCompatibility.minSdkVersion}`, 'cyan');
      log(`   - Android Min: ${completeTest.data.androidCompatibility.minAndroidVersion}`, 'cyan');
      log(`   - Cobertura: ${completeTest.data.androidCompatibility.marketCoverage}`, 'green');
      
      log('\n   ⚙️ Funcionalidades soportadas:', 'bright');
      completeTest.data.androidCompatibility.features.forEach(feature => {
        log(`   ✅ ${feature}`, 'green');
      });
    }
    
    console.log('');

    // Resumen final
    log('\n🎉 =====================================', 'green');
    log('🎉 TEST COMPLETADO', 'bright');
    log('🎉 =====================================\n', 'green');
    
    log('📝 Resumen de tests:', 'bright');
    log(`   - Test Simple: ${simpleTest.data.successful > 0 ? '✅' : '❌'}`, simpleTest.data.successful > 0 ? 'green' : 'red');
    log(`   - Test Compatibilidad: ${compatTest.data.successful > 0 ? '✅' : '❌'}`, compatTest.data.successful > 0 ? 'green' : 'red');
    log(`   - Test Firebase: ${firebaseTest.data.successful > 0 ? '✅' : '❌'}`, firebaseTest.data.successful > 0 ? 'green' : 'red');
    log(`   - Test Completo: ${completeTest.data.successful > 0 ? '✅' : '❌'}`, completeTest.data.successful > 0 ? 'green' : 'red');
    
    console.log('\n');

  } catch (error) {
    log(`\n❌ Error durante el test: ${error.message}`, 'red');
    console.error(error);
  }
}

// Ejecutar test
testServer();




