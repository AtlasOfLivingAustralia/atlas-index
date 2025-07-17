/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.queue.BroadcastService;
import au.org.ala.search.service.queue.LeaderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@ConditionalOnProperty(name = "rabbitmq.host")
@Configuration
@EnableRabbit
public class MessageQueueConfig {

    @Value("${rabbitmq.exchange.broadcast}") // TODO: change the config variable name to align
    public String broadcastExchange;
    @Value("${rabbitmq.exchange.direct}")
    public String directExchange;
    @Value("${rabbitmq.host:}")
    private String rabbitMqHost;
    @Value("${rabbitmq.port}")
    private String port;
    @Value("${rabbitmq.username}")
    private String username;
    @Value("${rabbitmq.password}")
    private String password;

    @Bean
    public FanoutExchange broadcastExchange() {
        return ExchangeBuilder.fanoutExchange(broadcastExchange).durable(true).build();
    }

    @Bean
    public Queue broadcastQueue() {
        return new Queue(BroadcastService.BROADCAST_QUEUE);
    }

    @Bean
    public Binding broadcastBinding(Queue broadcastQueue, FanoutExchange broadcastExchange) {
        return BindingBuilder.bind(broadcastQueue).to(broadcastExchange);
    }

    @Bean
    public DirectExchange directExchange() {
        return ExchangeBuilder.directExchange(directExchange).durable(true).build();
    }

    @Bean
    public Queue leaderQueue() {
        return new Queue(LeaderService.LEADER_QUEUE);
    }

    @Bean
    public Binding leaderBinding(Queue leaderQueue, DirectExchange directExchange) {
        return BindingBuilder.bind(leaderQueue)
                .to(directExchange)
                .with(LeaderService.LEADER_QUEUE);
    }

    @Bean
    public ConnectionFactory connectionFactory() {
        CachingConnectionFactory factory = new CachingConnectionFactory();
        factory.setHost(rabbitMqHost);

        // The port is being set incorrectly somewhere
        try {
            factory.setPort(Integer.parseInt(port));
        } catch (NumberFormatException e) {
            // This is a workaround for an exception that was seen when running in a container
            log.warn("Rabbitmq port invalid: {}, using default 5672", port);
            factory.setPort(5672);
        }
        factory.setUsername(username);
        factory.setPassword(password);
        factory.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);
        return factory;
    }

    /**
     * This is required for when overriding the default RabbitTemplate bean is required.
     *
     * @param connectionFactory
     * @return
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        log.info("RabbitTemplate for: {}:{}", rabbitMqHost, port);
        return new RabbitTemplate(connectionFactory);
    }

    @RabbitListener(queues = BroadcastService.BROADCAST_QUEUE)
    public void receiveMessage(String message) {
        // it is fine to ignore a broadcast message if BroadcastService is not initialized.
        if (BroadcastService.getInstance() != null) {
            BroadcastService.getInstance().receiveMessage(message);
        }
    }
}
