use std::collections::HashMap;
use std::time::Instant;

use axum::{Json, Router, http::StatusCode, routing::{get, post}};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
struct AlertInput {
    alert_id: String,
    timestamp: String,
    asset_id: String,
    source_ip: String,
    username: String,
    tactic: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CorrelateRequest {
    alerts: Vec<AlertInput>,
    #[serde(default = "default_window")]
    window_hours: i64,
}

fn default_window() -> i64 {
    6
}

#[derive(Debug, Serialize)]
struct CorrelateResponse {
    groups: Vec<Vec<String>>,
    took_ms: u64,
}

fn parse_ts(s: &str) -> Option<DateTime<Utc>> {
    s.parse::<DateTime<Utc>>().ok()
}

#[derive(Debug, Clone)]
struct Item {
    idx: usize,
    ts: DateTime<Utc>,
    asset_id: String,
    source_ip: String,
    username: String,
    tactic: Option<String>,
}

fn correlate(mut items: Vec<Item>, window_hours: i64) -> Vec<Vec<usize>> {
    if items.is_empty() {
        return vec![];
    }
    items.sort_by(|a, b| a.ts.cmp(&b.ts));
    // Pass 1: group by asset, split on gap > window or span > 24h
    let window = chrono::Duration::hours(window_hours);
    let max_span = chrono::Duration::hours(24);
    let mut groups: Vec<Vec<Item>> = Vec::new();
    let mut by_asset: HashMap<String, Vec<Item>> = HashMap::new();
    for it in items {
        by_asset.entry(it.asset_id.clone()).or_default().push(it);
    }
    for (_asset, mut v) in by_asset {
        v.sort_by(|a, b| a.ts.cmp(&b.ts));
        let mut cur: Vec<Item> = Vec::new();
        let mut start = v[0].ts;
        let mut prev = v[0].ts;
        for it in v {
            let gap = it.ts - prev;
            let span = it.ts - start;
            if !cur.is_empty() && (gap > window || span > max_span) {
                groups.push(std::mem::take(&mut cur));
                start = it.ts;
            }
            prev = it.ts;
            cur.push(it);
        }
        if !cur.is_empty() {
            groups.push(cur);
        }
    }
    // Pass 2: merge groups sharing entity + time overlap + shared non-null tactic
    let mut merged: Vec<Vec<Item>> = Vec::new();
    for g in groups {
        let mut placed = false;
        for m in merged.iter_mut() {
            let entity = g.iter().any(|a| {
                m.iter().any(|b| a.source_ip == b.source_ip || a.username == b.username)
            });
            if !entity {
                continue;
            }
            let (gmin, gmax) = (
                g.iter().map(|a| a.ts).min().unwrap(),
                g.iter().map(|a| a.ts).max().unwrap(),
            );
            let (mmin, mmax) = (
                m.iter().map(|a| a.ts).min().unwrap(),
                m.iter().map(|a| a.ts).max().unwrap(),
            );
            let overlap = gmin <= mmax && mmin <= gmax;
            if !overlap {
                continue;
            }
            let shared_tactic = g.iter().any(|a| {
                a.tactic.as_ref().is_some_and(|t| {
                    m.iter().any(|b| b.tactic.as_ref() == Some(t))
                })
            });
            if shared_tactic {
                m.extend(g.clone());
                placed = true;
                break;
            }
        }
        if !placed {
            merged.push(g);
        }
    }
    // Order: alerts chronological within groups, groups by max(ts) desc
    for m in merged.iter_mut() {
        m.sort_by(|a, b| a.ts.cmp(&b.ts));
    }
    merged.sort_by(|a, b| {
        b.iter()
            .map(|x| x.ts)
            .max()
            .cmp(&a.iter().map(|x| x.ts).max())
    });
    merged
        .into_iter()
        .map(|mut g| {
            g.sort_by(|a, b| a.ts.cmp(&b.ts));
            g.into_iter().map(|it| it.idx).collect()
        })
        .collect()
}

async fn correlate_handler(
    Json(req): Json<CorrelateRequest>,
) -> (StatusCode, Json<CorrelateResponse>) {
    let t0 = Instant::now();
    if req.alerts.is_empty() {
        return (StatusCode::OK, Json(CorrelateResponse { groups: vec![], took_ms: 0 }));
    }
    let items: Vec<Item> = req
        .alerts
        .iter()
        .enumerate()
        .filter_map(|(idx, a)| {
            parse_ts(&a.timestamp).map(|ts| Item {
                idx,
                ts,
                asset_id: a.asset_id.clone(),
                source_ip: a.source_ip.clone(),
                username: a.username.clone(),
                tactic: a.tactic.clone(),
            })
        })
        .collect();
    // Map placeholder idx back to alert_ids
    let ids: Vec<String> = req.alerts.iter().map(|a| a.alert_id.clone()).collect();
    let idx_groups = correlate(items, req.window_hours);
    let groups: Vec<Vec<String>> = idx_groups
        .into_iter()
        .map(|g| {
            g.into_iter()
                .map(|n| ids.get(n).cloned().unwrap_or_default())
                .collect()
        })
        .collect();
    let took_ms = t0.elapsed().as_millis() as u64;
    (StatusCode::OK, Json(CorrelateResponse { groups, took_ms }))
}

async fn healthz() -> Json<serde_json::Value> {
    Json(serde_json::json!({"ok": true}))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/correlate", post(correlate_handler))
        .route("/healthz", get(healthz));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8081")
        .await
        .expect("bind 8081");
    axum::serve(listener, app).await.expect("serve");
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn item(idx: usize, ts_h: i64, asset: &str, ip: &str, user: &str, tactic: Option<&str>) -> Item {
        Item {
            idx,
            ts: Utc.with_ymd_and_hms(2026, 10, 1, 0, 0, 0).unwrap()
                + chrono::Duration::hours(ts_h),
            asset_id: asset.into(),
            source_ip: ip.into(),
            username: user.into(),
            tactic: tactic.map(|s| s.into()),
        }
    }

    #[test]
    fn empty_input() {
        assert!(correlate(vec![], 6).is_empty());
    }

    #[test]
    fn splits_on_window_gap() {
        let v = vec![
            item(0, 0, "a", "1.1.1.1", "u", Some("TA0001")),
            item(1, 1, "a", "1.1.1.1", "u", Some("TA0001")),
            item(2, 10, "a", "9.9.9.9", "v", Some("TA0002")),
        ];
        let g = correlate(v, 6);
        assert_eq!(g.len(), 2);
    }

    #[test]
    fn splits_on_24h_span() {
        let v = vec![
            item(0, 0, "a", "1.1.1.1", "u", Some("TA0001")),
            item(1, 5, "a", "1.1.1.1", "u", Some("TA0001")),
            item(2, 10, "a", "1.1.1.1", "u", Some("TA0001")),
            item(3, 15, "a", "1.1.1.1", "u", Some("TA0001")),
            item(4, 20, "a", "1.1.1.1", "u", Some("TA0001")),
            item(5, 25, "a", "1.1.1.1", "u", Some("TA0001")),
        ];
        let g = correlate(v, 48);
        assert_eq!(g.len(), 2);
    }

    #[test]
    fn separate_assets_stay_separate() {
        let v = vec![
            item(0, 0, "a", "1.1.1.1", "u", Some("TA0001")),
            item(1, 0, "b", "2.2.2.2", "v", Some("TA0001")),
        ];
        let g = correlate(v, 6);
        assert_eq!(g.len(), 2);
    }

    #[test]
    fn cross_asset_entity_merge() {
        // Same IP + overlapping spans + shared tactic merges across assets
        let v = vec![
            item(0, 0, "a", "1.1.1.1", "u1", Some("TA0001")),
            item(1, 2, "a", "1.1.1.1", "u1", Some("TA0001")),
            item(2, 1, "b", "1.1.1.1", "u2", Some("TA0001")),
            item(3, 3, "b", "1.1.1.1", "u2", Some("TA0001")),
        ];
        let g = correlate(v, 6);
        assert_eq!(g.len(), 1);
    }

    #[test]
    fn no_merge_without_shared_tactic() {
        let v = vec![
            item(0, 0, "a", "1.1.1.1", "u1", Some("TA0001")),
            item(1, 1, "b", "1.1.1.1", "u2", Some("TA0002")),
        ];
        let g = correlate(v, 6);
        assert_eq!(g.len(), 2);
    }

    #[test]
    fn no_merge_without_entity_overlap() {
        let v = vec![
            item(0, 0, "a", "1.1.1.1", "u1", Some("TA0001")),
            item(1, 1, "b", "2.2.2.2", "u2", Some("TA0001")),
        ];
        let g = correlate(v, 6);
        assert_eq!(g.len(), 2);
    }
}
