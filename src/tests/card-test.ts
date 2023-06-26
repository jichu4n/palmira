import {
  DlpExpSlotEnumerateReqType,
  DlpVFSVolumeEnumerateReqType,
  DlpVFSVolumeGetLabelReqType,
  DlpVFSVolumeInfoReqType,
  SyncConnection,
} from '..';

export async function run({dlpConnection}: SyncConnection) {
  const {slots} = await dlpConnection.execute(new DlpExpSlotEnumerateReqType());
  // POSE with HostFS.prc does not support expansion manager functions, so
  // commented out.
  /*
  for (const slotRef of slots) {
    const cardPresentResp = await dlpConnection.execute(
      DlpExpCardPresentReqType.with({slotRef})
    );
    assert.notStrictEqual(cardPresentResp.errorCode, 0);
    const strings = await dlpConnection.execute(
      DlpExpCardInfoReqType.with({slotRefNum: slotRef})
    );
  }
  */

  const {volumes: volRefNums} = await dlpConnection.execute(
    new DlpVFSVolumeEnumerateReqType()
  );
  for (const volRefNum of volRefNums) {
    // await dlpConnection.execute(DlpVFSVolumeGetLabelReqType.with({volRefNum}));
    // await dlpConnection.execute(DlpVFSVolumeInfoReqType.with({volRefNum}));
  }
}