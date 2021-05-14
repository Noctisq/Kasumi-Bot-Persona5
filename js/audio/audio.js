// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');
const fs = require('fs');
// Creates a client
const client = new speech.SpeechClient();
const path = require('path');
async function quickstart(user) {
    // The path to the remote LINEAR16 file
    let filepath = path.join(__dirname, `../../${user}.raw`);
    const gcsUri = fs.readFileSync(filepath).toString('base64');
  
    // The audio file's encoding, sample rate in hertz, and BCP-47 language code
    const audio = {
      content: gcsUri,
    };
    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
    };
    const request = {
      audio: audio,
      config: config,
    };
  
    // Detects speech in the audio file
    const [response] = await client.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    console.log(`Transcription: ${transcription}`);
}

module.exports = {
    voice: quickstart
}
