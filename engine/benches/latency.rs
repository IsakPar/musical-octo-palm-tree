//! Latency benchmarks for the trading engine.
//!
//! Run with: cargo bench

use criterion::{black_box, criterion_group, criterion_main, Criterion};

/// Benchmark VWAP calculation (placeholder - will add real benchmarks)
fn bench_vwap_calculation(c: &mut Criterion) {
    c.bench_function("vwap_simple", |b| {
        b.iter(|| {
            // Simulate VWAP calculation
            let prices = vec![0.45, 0.46, 0.47];
            let sizes = vec![50.0, 30.0, 20.0];

            let total_value: f64 = prices.iter().zip(sizes.iter()).map(|(p, s)| p * s).sum();
            let total_size: f64 = sizes.iter().sum();

            black_box(total_value / total_size)
        })
    });
}

/// Benchmark order book update (placeholder)
fn bench_order_book_update(c: &mut Criterion) {
    c.bench_function("orderbook_update", |b| {
        b.iter(|| {
            // Simulate order book processing
            let mut bids: Vec<(f64, f64)> = vec![(0.45, 100.0), (0.44, 200.0), (0.43, 150.0)];
            bids.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
            black_box(bids)
        })
    });
}

criterion_group!(benches, bench_vwap_calculation, bench_order_book_update);
criterion_main!(benches);
