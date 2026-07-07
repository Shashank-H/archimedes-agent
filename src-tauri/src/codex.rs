use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const CODEX_OAUTH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_OAUTH_TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
const CODEX_AUTH_ISSUER: &str = "https://auth.openai.com";
const CODEX_BASE_URL: &str = "https://chatgpt.com/backend-api/codex";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexDeviceAuthStart {
    user_code: String,
    device_auth_id: String,
    verification_url: String,
    interval_seconds: u64,
    expires_in_seconds: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct CodexHttpResponse {
    status: u16,
    body: Value,
}

#[derive(Debug, Deserialize)]
struct UserCodeResponse {
    user_code: Option<String>,
    device_auth_id: Option<String>,
    interval: Option<Value>,
    expires_in: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct DeviceTokenResponse {
    authorization_code: Option<String>,
    code_verifier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
}

fn json_number(value: Option<Value>, fallback: u64) -> u64 {
    match value {
        Some(Value::Number(number)) => number.as_u64().unwrap_or(fallback),
        Some(Value::String(text)) => text.parse().unwrap_or(fallback),
        _ => fallback,
    }
}

fn reqwest_error(error: reqwest::Error) -> String {
    error.to_string()
}

async fn parse_json_or_text(response: reqwest::Response) -> Result<(u16, Value), String> {
    let status = response.status().as_u16();
    let text = response.text().await.map_err(reqwest_error)?;
    if text.trim().is_empty() {
        return Ok((status, Value::Null));
    }
    let body = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "message": text }));
    Ok((status, body))
}

fn token_response(payload: OAuthTokenResponse, fallback_refresh_token: Option<&str>) -> Result<CodexTokenResponse, String> {
    let access_token = payload
        .access_token
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| "OpenAI token response did not include an access token.".to_string())?;
    let refresh_token = payload
        .refresh_token
        .or_else(|| fallback_refresh_token.map(str::to_string))
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| "OpenAI token response did not include a refresh token.".to_string())?;

    Ok(CodexTokenResponse {
        access_token,
        refresh_token,
        expires_in: payload.expires_in,
    })
}

#[tauri::command]
pub async fn codex_device_auth_start() -> Result<CodexDeviceAuthStart, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{CODEX_AUTH_ISSUER}/api/accounts/deviceauth/usercode"))
        .json(&json!({ "client_id": CODEX_OAUTH_CLIENT_ID }))
        .send()
        .await
        .map_err(reqwest_error)?;

    let (status, body) = parse_json_or_text(response).await?;
    if !(200..300).contains(&status) {
        return Err(format!("OpenAI device code request failed with HTTP {status}: {body}"));
    }

    let payload: UserCodeResponse = serde_json::from_value(body).map_err(|error| error.to_string())?;
    let user_code = payload
        .user_code
        .filter(|code| !code.trim().is_empty())
        .ok_or_else(|| "OpenAI device code response was missing user_code.".to_string())?;
    let device_auth_id = payload
        .device_auth_id
        .filter(|id| !id.trim().is_empty())
        .ok_or_else(|| "OpenAI device code response was missing device_auth_id.".to_string())?;

    Ok(CodexDeviceAuthStart {
        user_code,
        device_auth_id,
        verification_url: format!("{CODEX_AUTH_ISSUER}/codex/device"),
        interval_seconds: json_number(payload.interval, 5).max(3),
        expires_in_seconds: json_number(payload.expires_in, 900),
    })
}

#[tauri::command]
pub async fn codex_device_auth_poll(
    device_auth_id: String,
    user_code: String,
) -> Result<Option<CodexTokenResponse>, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{CODEX_AUTH_ISSUER}/api/accounts/deviceauth/token"))
        .json(&json!({ "device_auth_id": device_auth_id, "user_code": user_code }))
        .send()
        .await
        .map_err(reqwest_error)?;

    let status = response.status().as_u16();
    if status == 403 || status == 404 {
        return Ok(None);
    }

    let (status, body) = parse_json_or_text(response).await?;
    if !(200..300).contains(&status) {
        return Err(format!("OpenAI device authorization polling failed with HTTP {status}: {body}"));
    }

    let payload: DeviceTokenResponse = serde_json::from_value(body).map_err(|error| error.to_string())?;
    let authorization_code = payload
        .authorization_code
        .filter(|code| !code.trim().is_empty())
        .ok_or_else(|| "OpenAI device authorization response was missing authorization_code.".to_string())?;
    let code_verifier = payload
        .code_verifier
        .filter(|code| !code.trim().is_empty())
        .ok_or_else(|| "OpenAI device authorization response was missing code_verifier.".to_string())?;

    let exchange_response = client
        .post(CODEX_OAUTH_TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", authorization_code.as_str()),
            ("redirect_uri", "https://auth.openai.com/deviceauth/callback"),
            ("client_id", CODEX_OAUTH_CLIENT_ID),
            ("code_verifier", code_verifier.as_str()),
        ])
        .send()
        .await
        .map_err(reqwest_error)?;
    let (token_status, token_body) = parse_json_or_text(exchange_response).await?;
    if !(200..300).contains(&token_status) {
        return Err(format!("OpenAI token exchange failed with HTTP {token_status}: {token_body}"));
    }

    let tokens: OAuthTokenResponse = serde_json::from_value(token_body).map_err(|error| error.to_string())?;
    token_response(tokens, None).map(Some)
}

#[tauri::command]
pub async fn codex_refresh_token(refresh_token: String) -> Result<CodexTokenResponse, String> {
    if refresh_token.trim().is_empty() {
        return Err("OpenAI Codex session is missing a refresh token. Sign in again.".to_string());
    }

    let client = reqwest::Client::new();
    let response = client
        .post(CODEX_OAUTH_TOKEN_URL)
        .header("Accept", "application/json")
        .header("User-Agent", "archimedes-agent/0.1.0")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("client_id", CODEX_OAUTH_CLIENT_ID),
        ])
        .send()
        .await
        .map_err(reqwest_error)?;

    let (status, body) = parse_json_or_text(response).await?;
    if !(200..300).contains(&status) {
        return Err(format!("OpenAI Codex token refresh failed with HTTP {status}: {body}"));
    }

    let tokens: OAuthTokenResponse = serde_json::from_value(body).map_err(|error| error.to_string())?;
    token_response(tokens, Some(refresh_token.as_str()))
}

#[tauri::command]
pub async fn codex_http_request(
    method: String,
    base_url: Option<String>,
    path: String,
    access_token: String,
    account_id: Option<String>,
    body: Option<Value>,
) -> Result<CodexHttpResponse, String> {
    if access_token.trim().is_empty() {
        return Err("OpenAI Codex session is missing an access token. Sign in again.".to_string());
    }

    let allowed = path == "/responses" || path == "/models?client_version=1.0.0";
    if !allowed {
        return Err("Unsupported OpenAI Codex endpoint.".to_string());
    }

    let base_url = base_url
        .filter(|url| !url.trim().is_empty())
        .unwrap_or_else(|| CODEX_BASE_URL.to_string())
        .trim_end_matches('/')
        .to_string();
    let url = format!("{base_url}{path}");
    let client = reqwest::Client::new();
    let request = match method.to_ascii_uppercase().as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        _ => return Err("Unsupported OpenAI Codex HTTP method.".to_string()),
    }
    .bearer_auth(access_token)
    .header("Accept", "application/json")
    .header("OpenAI-Beta", "responses=experimental")
    .header("originator", "archimedes")
    .header("User-Agent", "archimedes-agent/0.1.0");

    let request = if let Some(account_id) = account_id.filter(|value| !value.trim().is_empty()) {
        request.header("chatgpt-account-id", account_id)
    } else {
        request
    };
    let request = if let Some(body) = body { request.json(&body) } else { request };
    let response = request.send().await.map_err(reqwest_error)?;
    let (status, body) = parse_json_or_text(response).await?;

    Ok(CodexHttpResponse { status, body })
}
