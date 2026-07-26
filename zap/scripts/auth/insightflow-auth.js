// ZAP Authentication Script - InsightFlow
// Handles JWT-based authentication for scanning

var headless = Java.type('org.zaproxy.addon.network.ClientCertificatesOptions');
var HttpRequestHeader = Java.type('org.parosproxy.paros.network.HttpRequestHeader');
var URI = Java.type('org.apache.commons.httpclient.URI');

function authenticate(helper, paramsValues, credentials) {
  print("[ZAP Auth] Authenticating as " + credentials.getParam('email'));

  var loginUrl = paramsValues.get('authEndpoint') || 'http://localhost:3001/api/auth/login';
  var email = credentials.getParam('email');
  var password = credentials.getParam('password');

  var requestBody = JSON.stringify({
    email: email,
    password: password
  });

  var requestHeaders = new HttpRequestHeader(
    'POST ' + new URI(loginUrl, true).toString() + ' HTTP/1.1\r\n' +
    'Host: localhost:3001\r\n' +
    'Content-Type: application/json\r\n' +
    'Content-Length: ' + requestBody.length + '\r\n'
  );

  var msg = helper.prepareMessage();
  msg.setRequestHeader(requestHeaders);
  msg.setRequestBody(requestBody);

  helper.sendAndReceive(msg);

  var responseBody = msg.getResponseBody().toString();
  var responseCode = msg.getResponseHeader().getStatusCode();

  if (responseCode === 200) {
    try {
      var jsonResponse = JSON.parse(responseBody);
      var accessToken = jsonResponse.data && jsonResponse.data.accessToken;

      if (accessToken) {
        print("[ZAP Auth] Token obtained successfully");
        msg.getRequestHeader().setHeader("Authorization", "Bearer " + accessToken);
        return msg;
      }
    } catch (e) {
      print("[ZAP Auth] Failed to parse auth response: " + e);
    }
  }

  print("[ZAP Auth] Authentication failed: HTTP " + responseCode);
  return msg;
}

function getRequiredParamsNames() {
  return ["authEndpoint"];
}

function getOptionalParamsNames() {
  return [];
}

function getCredentialsParamNames() {
  return ["email", "password"];
}
