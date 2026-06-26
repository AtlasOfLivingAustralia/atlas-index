/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service;

import au.org.ala.search.AbstractIntegrationTestContainers;
import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.cache.CollectoryCache;
import au.org.ala.search.service.cache.ListCache;
import au.org.ala.search.service.queue.BroadcastQueue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest
public class BroadcastConsumerServiceIntegrationTest extends AbstractIntegrationTestContainers {

    @MockBean
    private CollectoryCache collectoryCache;

    @MockBean
    private ListCache listCache;

    @Autowired
    private BroadcastQueue broadcastQueue;

    @Test
    void testSendAndReceiveCacheReset() throws InterruptedException {
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_ALL, null);
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_ALL, null);
        broadcastQueue.sendMessage(TaskType.CACHE_RESET_ALL, null);

        // Wait for async message consumption
        Thread.sleep(2000);

        verify(collectoryCache, times(3)).cacheRefresh();
        verify(listCache, times(3)).cacheRefresh();
    }
}
