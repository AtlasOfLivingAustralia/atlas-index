package au.org.ala;

import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

public class RateLimiterTest {

    @Test
    void testImmediateBurst() throws InterruptedException {
        // Rate limiter allows up to burst size without delay
        RateLimiter limiter = new RateLimiter(10.0, 5.0);

        long start = System.currentTimeMillis();
        for (int i = 0; i < 5; i++) {
            limiter.acquire();
        }
        long elapsed = System.currentTimeMillis() - start;

        // 5 burst tokens should be acquired almost instantaneously (< 50ms)
        assertTrue(elapsed < 100, "Burst took too long: " + elapsed + "ms");
    }

    @Test
    void testThrottlingAfterBurst() throws InterruptedException {
        // 20 req/sec with burst of 1 means subsequent calls must wait ~50ms each
        RateLimiter limiter = new RateLimiter(20.0, 1.0);

        limiter.acquire(); // takes the 1 burst token
        long start = System.currentTimeMillis();
        limiter.acquire(); // must wait ~50ms
        limiter.acquire(); // must wait another ~50ms
        long elapsed = System.currentTimeMillis() - start;

        // 2 requests at 20 req/s should take at least 80ms
        assertTrue(elapsed >= 80, "Throttling was not enforced, elapsed: " + elapsed + "ms");
    }

    @Test
    void testConcurrentAcquire() throws InterruptedException {
        int threads = 5;
        int requestsPerThread = 4;
        int totalRequests = threads * requestsPerThread;

        // 50 req/sec, burst of 5
        RateLimiter limiter = new RateLimiter(50.0, 5.0);
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(totalRequests);
        AtomicInteger count = new AtomicInteger(0);

        long start = System.currentTimeMillis();
        for (int t = 0; t < threads; t++) {
            executor.submit(() -> {
                for (int r = 0; r < requestsPerThread; r++) {
                    try {
                        limiter.acquire();
                        count.incrementAndGet();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        latch.countDown();
                    }
                }
            });
        }

        latch.await();
        long elapsed = System.currentTimeMillis() - start;
        executor.shutdown();

        assertEquals(totalRequests, count.get());
        // 20 requests at 50/sec (after 5 burst, 15 remaining = 300ms min)
        assertTrue(elapsed >= 250, "Concurrent throttling was too fast: " + elapsed + "ms");
    }

    @Test
    void testFractionalBurstCapacityDoesNotDeadlock() throws InterruptedException {
        // With rate 5.0 and maxBurst passed as 0.2, capacity must be clamped to >= 1.0
        // to avoid deadlocking worker threads while pacing requests.
        RateLimiter limiter = new RateLimiter(5.0, 0.2);

        long start = System.currentTimeMillis();
        limiter.acquire(); // takes initial burst token (1.0)
        limiter.acquire(); // waits ~200ms for refill at 5 req/s
        long elapsed = System.currentTimeMillis() - start;

        assertTrue(elapsed >= 150, "Throttling was not enforced: " + elapsed + "ms");
        assertTrue(elapsed < 2000, "Acquire deadlocked or took too long: " + elapsed + "ms");
    }
}
