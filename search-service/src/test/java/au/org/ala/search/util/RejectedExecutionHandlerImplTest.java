/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure-logic unit tests for {@link RejectedExecutionHandlerImpl}. No Spring context, no
 * containers — exercises the handler directly against a real {@link ThreadPoolExecutor} whose
 * worker threads are never started, so tasks accumulate in the queue predictably.
 */
class RejectedExecutionHandlerImplTest {

    private final RejectedExecutionHandlerImpl handler = new RejectedExecutionHandlerImpl();

    private ThreadPoolExecutor executor;

    @AfterEach
    void shutdownExecutor() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    @Test
    void rejectedExecution_putsTaskBackOnQueue() throws InterruptedException {
        executor = new ThreadPoolExecutor(
                1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>());

        Runnable task = () -> {};
        handler.rejectedExecution(task, executor);

        assertThat(executor.getQueue()).hasSize(1);
        assertThat(executor.getQueue().take()).isSameAs(task);
    }

    @Test
    void rejectedExecution_multipleTasks_allQueuedInOrder() {
        executor = new ThreadPoolExecutor(
                1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>());

        Runnable task1 = () -> {};
        Runnable task2 = () -> {};
        handler.rejectedExecution(task1, executor);
        handler.rejectedExecution(task2, executor);

        assertThat(executor.getQueue()).containsExactly(task1, task2);
    }

    @Test
    void rejectedExecution_interruptedWhilePutting_throwsRejectedExecutionException() {
        executor = new ThreadPoolExecutor(
                1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>());

        // Pre-interrupt the current thread: BlockingQueue#put checks the interrupt status
        // before attempting to acquire its lock and throws InterruptedException immediately,
        // even for an unbounded queue with no blocking required.
        Thread.currentThread().interrupt();
        try {
            assertThatThrownBy(() -> handler.rejectedExecution(() -> {}, executor))
                    .isInstanceOf(RejectedExecutionException.class)
                    .hasCauseInstanceOf(InterruptedException.class);
        } finally {
            // clear interrupt flag so it doesn't leak into other tests
            Thread.interrupted();
        }
    }
}
