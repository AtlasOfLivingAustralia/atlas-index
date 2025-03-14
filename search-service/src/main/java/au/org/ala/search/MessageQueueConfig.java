package au.org.ala.search;

 import au.org.ala.search.service.queue.BroadcastService;
 import org.springframework.amqp.core.*;
 import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
 import org.springframework.amqp.rabbit.connection.ConnectionFactory;
 import org.springframework.amqp.rabbit.core.RabbitTemplate;
 import org.springframework.beans.factory.annotation.Value;
 import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
 import org.springframework.context.annotation.Bean;
 import org.springframework.context.annotation.Configuration;

 @Configuration
 public class MessageQueueConfig {

     @Value("${rabbitmq.host}")
     private String host;

     @Value("${rabbitmq.port}")
     private int port;

     @Value("${rabbitmq.username}")
     private String username;

     @Value("${rabbitmq.password}")
     private String password;

     @Value("${rabbitmq.exchange}")
     public String exchange;

     @Bean
     public FanoutExchange broadcastExchange() {
         return ExchangeBuilder.fanoutExchange(exchange).durable(true).build();
     }

     @Bean
     public Queue broadcastQueue() {
         return new Queue(BroadcastService.BROADCAST_QUEUE);
     }

     @Bean
     public Binding binding(Queue broadcastQueue, FanoutExchange broadcastExchange) {
         return BindingBuilder.bind(broadcastQueue).to(broadcastExchange);
     }

     @Bean
     @ConditionalOnProperty(name = "rabbitmq.host")
     public ConnectionFactory connectionFactory() {
         CachingConnectionFactory factory = new CachingConnectionFactory();
         factory.setHost(host);
         factory.setPort(port);
         factory.setUsername(username);
         factory.setPassword(password);
         factory.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);
         return factory;
     }

     @Bean
     @ConditionalOnProperty(name = "rabbitmq.host")
     public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
         RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
         return rabbitTemplate;
     }

 }
