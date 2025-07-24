/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.search.service.queue.BroadcastQueue;
import au.org.ala.search.service.queue.LeaderQueue;
import au.org.ala.search.service.queue.ConsumerQueue;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.amqp.SimpleRabbitListenerContainerFactoryConfigurer;
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
    @Value("${rabbitmq.task.concurrency:1}")
    private int concurrentUserTasks; // set at runtime

    @Bean
    public FanoutExchange broadcastExchange() {
        return ExchangeBuilder.fanoutExchange(broadcastExchange).durable(true).build();
    }

    @Bean
    public Queue broadcastQueueDefn() {
        return new Queue(BroadcastQueue.BROADCAST_QUEUE);
    }

    @Bean
    public Binding broadcastBinding(Queue broadcastQueueDefn, FanoutExchange broadcastExchange) {
        return BindingBuilder.bind(broadcastQueueDefn).to(broadcastExchange);
    }

    @Bean
    public DirectExchange directExchange() {
        return ExchangeBuilder.directExchange(directExchange).durable(true).build();
    }

    @Bean
    public Queue leaderQueueDfn() {
        return new Queue(LeaderQueue.LEADER_QUEUE);
    }

    @Bean
    public Binding leaderBinding(Queue leaderQueueDfn, DirectExchange directExchange) {
        return BindingBuilder.bind(leaderQueueDfn)
                .to(directExchange)
                .with(LeaderQueue.LEADER_QUEUE);
    }

    @Bean
    public Queue consumerQueueDfn() {
        return new Queue(ConsumerQueue.TASK_QUEUE);
    }

    @Bean
    public Binding consumerQueueBinding(Queue consumerQueueDfn, DirectExchange directExchange) {
        return BindingBuilder.bind(consumerQueueDfn)
                .to(directExchange)
                .with(ConsumerQueue.TASK_QUEUE);
    }

    @Bean
    public SimpleRabbitListenerContainerFactory consumerQueueListenerContainerFactory(SimpleRabbitListenerContainerFactoryConfigurer configurer,
                                                                               ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        configurer.configure(factory, connectionFactory);
        factory.setConcurrentConsumers(2); // initial number of consumers
        factory.setMaxConcurrentConsumers(concurrentUserTasks);
        return factory;
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

    @RabbitListener(queues = BroadcastQueue.BROADCAST_QUEUE)
    public void receiveMessage(byte [] message) {
        // it is fine to ignore a broadcast message if BroadcastService is not initialized.
        if (BroadcastQueue.getInstance() != null) {
            BroadcastQueue.getInstance().receiveMessage(message);
        }
    }
}
