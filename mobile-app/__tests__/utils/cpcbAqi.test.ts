import {
  computeCpcbAqi,
  getAqiCategoryAndColor,
  formatDataSource,
  formatBackendStatus,
  formatFederatedImplementation,
} from '../../src/api/client';

describe('CPCB AQI & Formatting Utilities (DEC-010 Standards)', () => {
  describe('computeCpcbAqi', () => {
    it('returns 0 for zero or non-positive input', () => {
      expect(computeCpcbAqi(0)).toBe(0);
      expect(computeCpcbAqi(-5)).toBe(0);
      expect(computeCpcbAqi(NaN)).toBe(0);
    });

    it('returns 500 for infinite or extreme concentration', () => {
      expect(computeCpcbAqi(Infinity)).toBe(500);
      expect(computeCpcbAqi(999)).toBe(500);
    });

    it('accurately interpolates within Good category (0-30 µg/m³ -> 0-50 AQI)', () => {
      expect(computeCpcbAqi(15)).toBe(25);
      expect(computeCpcbAqi(30)).toBe(50);
    });

    it('accurately interpolates within Satisfactory category (31-60 µg/m³ -> 51-100 AQI)', () => {
      const aqiMid = computeCpcbAqi(45);
      expect(aqiMid).toBeGreaterThanOrEqual(51);
      expect(aqiMid).toBeLessThanOrEqual(100);
      expect(computeCpcbAqi(60)).toBe(100);
    });

    it('accurately interpolates within Moderate category (61-90 µg/m³ -> 101-200 AQI)', () => {
      expect(computeCpcbAqi(90)).toBe(200);
    });

    it('accurately interpolates within Poor category (91-120 µg/m³ -> 201-300 AQI)', () => {
      expect(computeCpcbAqi(120)).toBe(300);
    });

    it('accurately interpolates within Very Poor category (121-250 µg/m³ -> 301-400 AQI)', () => {
      expect(computeCpcbAqi(250)).toBe(400);
    });

    it('accurately interpolates within Severe category (251-380 µg/m³ -> 401-500 AQI)', () => {
      expect(computeCpcbAqi(380)).toBe(500);
    });
  });

  describe('getAqiCategoryAndColor', () => {
    it('categorizes 25 as Good with green color', () => {
      const res = getAqiCategoryAndColor(25);
      expect(res.category).toBe('Good');
      expect(res.color).toBe('#10B981');
    });

    it('categorizes 75 as Satisfactory', () => {
      const res = getAqiCategoryAndColor(75);
      expect(res.category).toBe('Satisfactory');
    });

    it('categorizes 150 as Moderate', () => {
      const res = getAqiCategoryAndColor(150);
      expect(res.category).toBe('Moderate');
    });

    it('categorizes 250 as Poor', () => {
      const res = getAqiCategoryAndColor(250);
      expect(res.category).toBe('Poor');
    });

    it('categorizes 350 as Very Poor', () => {
      const res = getAqiCategoryAndColor(350);
      expect(res.category).toBe('Very Poor');
    });

    it('categorizes 450+ as Severe with purple/deep color', () => {
      const res = getAqiCategoryAndColor(450);
      expect(res.category).toBe('Severe');
      expect(res.color).toBe('#7C2D12');
    });
  });

  describe('formatDataSource and status helpers', () => {
    it('formats NASA FIRMS known source correctly', () => {
      expect(formatDataSource('NASA_FIRMS_VIIRS_SNPP_NRT')).toBe('NASA FIRMS VIIRS near-real-time');
    });

    it('formats OpenAQ live correctly', () => {
      expect(formatDataSource('OPENAQ_LIVE')).toBe('OpenAQ live station observation');
    });

    it('formats backend status labels', () => {
      expect(formatBackendStatus('not_measured')).toBe('Not measured');
      expect(formatBackendStatus('vectors_available')).toBe('Vectors Available');
    });

    it('formats federated implementation label', () => {
      expect(
        formatFederatedImplementation('numpy_fedavg_with_optional_paillier_and_dp_sgd')
      ).toBe('NumPy FedAvg with configured privacy controls');
    });
  });
});
