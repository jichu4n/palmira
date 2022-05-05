/** Script to record a NetSync session for testing. */
import {Argument, program} from 'commander';
import debug from 'debug';
import pEvent from 'p-event';
import path from 'path';
import {
  NetSyncConnection,
  NetSyncServer,
  SerialNetworkSyncServer,
  SerialSyncServer,
  SyncFn,
} from '..';

export function getSyncFn(testModule: string) {
  const syncFn: (connection: NetSyncConnection) => Promise<void> =
    require(`./${testModule}`).run;
  if (!syncFn) {
    throw new Error(`Could not find run function in module ${testModule}`);
  }
  return syncFn;
}

export function getRecordedSessionFilePath(
  connectionType: ConnectionType,
  testModule: string
) {
  return path.join(
    __dirname,
    'testdata',
    `${testModule}.${connectionType}.json`
  );
}

export enum ConnectionType {
  NETWORK = 'network',
  SERIAL_OVER_NETWORK = 'serial-over-network',
  SERIAL = 'serial',
}

export function getServerTypeForConnectionType(connectionType: ConnectionType) {
  switch (connectionType) {
    case ConnectionType.NETWORK:
      return (syncFn: SyncFn) => new NetSyncServer(syncFn);
    case ConnectionType.SERIAL_OVER_NETWORK:
      return (syncFn: SyncFn) => new SerialNetworkSyncServer(syncFn);
    case ConnectionType.SERIAL:
      return (syncFn: SyncFn) => new SerialSyncServer('/dev/ttyS0', syncFn);
    default:
      throw new Error(`Unknown connection type ${connectionType}`);
  }
}

if (require.main === module) {
  (async function () {
    debug.enable('palmira:*');
    const log = debug('palmira').extend('record-sync-session');
    program
      .name('record-sync-session')
      .description('Script to record a NetSync session for testing.')
      .addArgument(
        new Argument('<connectionType>', 'Connection type').choices(
          Object.values(ConnectionType)
        )
      )
      .argument('<test-module>', 'Test module to run, relative to this script')
      .action(async (connectionType: ConnectionType, testModule: string) => {
        const syncFn = getSyncFn(testModule);
        const recordedSessionFilePath = getRecordedSessionFilePath(
          connectionType,
          testModule
        );
        log(`Running ${testModule}, recording to ${recordedSessionFilePath}`);

        const syncServer =
          getServerTypeForConnectionType(connectionType)(syncFn);
        syncServer.start();

        log('Waiting for connection...');
        await pEvent(syncServer, 'connect');
        log('Connected!');
        const connection: NetSyncConnection = await pEvent(
          syncServer,
          'disconnect'
        );
        log('Disconnected');
        await connection.recorder.writeFile(recordedSessionFilePath);
        await syncServer.stop();
      });
    await program.parseAsync();
  })();
}