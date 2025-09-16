// utils/cameras.ts

async function getListOfCameras(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  }
  
  async function getListOfMicrophones(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audioinput");
  }
  
  async function getMediaStream(
    videoDeviceId?: string,
    audioDeviceId?: string
  ): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
      audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  
  export { getListOfCameras, getListOfMicrophones, getMediaStream };
  