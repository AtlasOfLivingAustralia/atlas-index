package au.org.ala;

/**
 * A lightweight token bucket rate limiter to pace requests across concurrent threads.
 * Uses native Java synchronization without external dependencies.
 */
public class RateLimiter {

    private final double maxRequestsPerSecond;
    private final double maxBurst;
    private double availableTokens;
    private long lastRefillTimestamp;

    public RateLimiter(double maxRequestsPerSecond, double maxBurst) {
        if (maxRequestsPerSecond <= 0) {
            throw new IllegalArgumentException("maxRequestsPerSecond must be positive");
        }
        this.maxRequestsPerSecond = maxRequestsPerSecond;
        this.maxBurst = maxBurst > 0 ? maxBurst : Math.max(1.0, maxRequestsPerSecond);
        this.availableTokens = this.maxBurst;
        this.lastRefillTimestamp = System.currentTimeMillis();
    }

    public synchronized void acquire() throws InterruptedException {
        while (true) {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefillTimestamp;
            lastRefillTimestamp = now;
            availableTokens = Math.min(maxBurst, availableTokens + (elapsed * maxRequestsPerSecond / 1000.0));

            if (availableTokens >= 1.0) {
                availableTokens -= 1.0;
                return;
            }

            double needed = 1.0 - availableTokens;
            long waitMs = Math.max(1L, (long) Math.ceil((needed / maxRequestsPerSecond) * 1000.0));
            Thread.sleep(waitMs);
        }
    }

    public double getMaxRequestsPerSecond() {
        return maxRequestsPerSecond;
    }
}
