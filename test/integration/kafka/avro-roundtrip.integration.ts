/**
 * Integration test: Avro round-trip via Redpanda Schema Registry.
 * Spins up a real Redpanda container using Testcontainers.
 * Registers an Avro schema, encodes a payload, produces it to Kafka,
 * consumes it, decodes it, and asserts round-trip equality.
 */

import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';

const TEST_SCHEMA = {
  type: 'record',
  name: 'CertificationDecisionGranted',
  namespace: 'ma.terroir.test',
  fields: [
    { name: 'eventId', type: 'string' },
    { name: 'certificationId', type: 'string' },
    { name: 'certificationNumber', type: 'string' },
  ],
};

const TOPIC = 'test.certification.decision.granted';
const SUBJECT = `${TOPIC}-value`;
const ORIGINAL_PAYLOAD = {
  eventId: 'evt-integration-001',
  certificationId: 'cert-integration-001',
  certificationNumber: 'TERROIR-IGP-SFI-2026-001',
};

describe('Avro round-trip integration (Redpanda)', () => {
  let container: StartedTestContainer;
  let kafkaProducer: Producer;
  let kafkaConsumer: Consumer;
  let registry: SchemaRegistry;
  let schemaId: number;

  beforeAll(async () => {
    container = await new GenericContainer('redpandadata/redpanda:v23.3.5')
      .withExposedPorts(9092, 8081)
      .withCommand([
        'redpanda',
        'start',
        '--smp=1',
        '--memory=256M',
        '--reserve-memory=0M',
        '--overprovisioned',
        '--node-id=0',
        '--check=false',
        '--kafka-addr=0.0.0.0:9092',
        '--advertise-kafka-addr=localhost:9092',
        '--schema-registry-addr=0.0.0.0:8081',
      ])
      .withStartupTimeout(90_000)
      .start();

    const brokerPort = container.getMappedPort(9092);
    const registryPort = container.getMappedPort(8081);
    const brokers = [`localhost:${brokerPort}`];
    const registryHost = `http://localhost:${registryPort}`;

    registry = new SchemaRegistry({ host: registryHost });

    const { id } = await registry.register(
      { type: SchemaType.AVRO, schema: JSON.stringify(TEST_SCHEMA) },
      { subject: SUBJECT },
    );
    schemaId = id;

    const kafka = new Kafka({ clientId: 'avro-test-client', brokers, logLevel: logLevel.NOTHING });
    kafkaProducer = kafka.producer();
    kafkaConsumer = kafka.consumer({ groupId: 'avro-test-group' });

    await kafkaProducer.connect();
    await kafkaConsumer.connect();
  }, 120_000);

  afterAll(async () => {
    await kafkaProducer?.disconnect();
    await kafkaConsumer?.disconnect();
    await container?.stop();
  });

  it('encodes an event as Avro binary, produces it, consumes it, and decodes back to original payload', async () => {
    const encoded = await registry.encode(schemaId, ORIGINAL_PAYLOAD);

    await kafkaProducer.send({
      topic: TOPIC,
      messages: [{ value: encoded }],
    });

    let decoded: typeof ORIGINAL_PAYLOAD | null = null;

    await kafkaConsumer.subscribe({ topic: TOPIC, fromBeginning: true });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for message')), 30_000);

      kafkaConsumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          decoded = (await registry.decode(message.value)) as typeof ORIGINAL_PAYLOAD;
          clearTimeout(timeout);
          resolve();
        },
      });
    });

    expect(decoded).toEqual(ORIGINAL_PAYLOAD);
  }, 60_000);
});
