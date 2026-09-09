import { uploadCitizenSkyPhoto } from '../../src/api/client';
import { base64ToUint8Array } from '../../src/screens/CitizenScannerScreen';

describe('uploadCitizenSkyPhoto & base64 conversion', () => {
  const originalFetch = globalThis.fetch;
  const originalXHR = (globalThis as any).XMLHttpRequest;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as any).XMLHttpRequest = originalXHR;
    jest.clearAllMocks();
  });

  describe('base64ToUint8Array', () => {
    it('decodes standard base64 strings into Uint8Array', () => {
      // "ABC" in ASCII is [65, 66, 67], base64 is "QUJD"
      const result = base64ToUint8Array('QUJD');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(3);
      expect(Array.from(result)).toEqual([65, 66, 67]);
    });

    it('handles base64 data URI headers properly', () => {
      const result = base64ToUint8Array('data:image/jpeg;base64,QUJD');
      expect(Array.from(result)).toEqual([65, 66, 67]);
    });
  });

  describe('uploadCitizenSkyPhoto', () => {
    it('successfully uploads photo via fetch when supported', async () => {
      const mockResponse = {
        observation_id: 'obs_123',
        pm25_estimate: 85.4,
        aqi_index: 185,
        aqi_category: 'Moderate',
        aqi_color: '#F59E0B',
        confidence: 'high',
        processing_time_ms: 120,
      };

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const formData = new FormData();
      formData.append('latitude', '28.6472');
      formData.append('longitude', '77.3160');

      const result = await uploadCitizenSkyPhoto(formData);
      expect(result.pm25_estimate).toBe(85.4);
      expect(result.aqi_category).toBe('Moderate');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to XMLHttpRequest when fetch throws "Unsupported FormDataPart implementation"', async () => {
      const mockResponse = {
        observation_id: 'obs_456',
        pm25_estimate: 142.0,
        aqi_index: 310,
        aqi_category: 'Very Poor',
        aqi_color: '#EF4444',
        confidence: 'high',
        processing_time_ms: 95,
      };

      // Simulate Expo WinterCG fetch throwing the exact error
      globalThis.fetch = jest.fn().mockRejectedValue(new Error('Unsupported FormDataPart implementation'));

      // Mock native XMLHttpRequest
      const mockXHRInstance = {
        open: jest.fn(),
        send: jest.fn(function (this: any) {
          this.status = 200;
          this.responseText = JSON.stringify(mockResponse);
          this.onload();
        }),
        timeout: 0,
        onload: jest.fn(),
        onerror: jest.fn(),
        ontimeout: jest.fn(),
      };

      (globalThis as any).XMLHttpRequest = jest.fn(() => mockXHRInstance);

      const formData = new FormData();
      formData.append('photo', { uri: 'file:///path/to/sky.jpg', name: 'sky.jpg', type: 'image/jpeg' } as any);

      const result = await uploadCitizenSkyPhoto(formData);
      expect(result.pm25_estimate).toBe(142.0);
      expect(result.aqi_category).toBe('Very Poor');
      expect(mockXHRInstance.open).toHaveBeenCalledWith('POST', expect.stringContaining('/api/v1/citizen/photo'));
      expect(mockXHRInstance.send).toHaveBeenCalledWith(formData);
    });

    it('throws server error message if fetch returns non-200 status', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid file type. JPEG or PNG only.' }),
      });

      const formData = new FormData();
      await expect(uploadCitizenSkyPhoto(formData)).rejects.toThrow('Invalid file type. JPEG or PNG only.');
    });
  });
});
