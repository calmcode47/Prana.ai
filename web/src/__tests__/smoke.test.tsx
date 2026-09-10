import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { ConvergenceChart } from '../components/ui/ConvergenceChart';
import { computeCpcbAqi, getAuthToken, setAuthToken, API_BASE } from '../api/client';

describe('Web UI Primitives Smoke Tests', () => {
  it('renders Button with variants and labels', () => {
    render(<Button variant="primary">Enforce Notice</Button>);
    expect(screen.getByRole('button', { name: /Enforce Notice/i })).toBeInTheDocument();
  });

  it('renders Card with children and headers', () => {
    render(
      <Card header={<h4>Airshed Status</h4>}>
        <p>Telemetry nominal</p>
      </Card>
    );
    expect(screen.getByText('Airshed Status')).toBeInTheDocument();
    expect(screen.getByText('Telemetry nominal')).toBeInTheDocument();
  });

  it('renders Badge with severity classification', () => {
    render(<Badge variant="severe">AQI 450</Badge>);
    expect(screen.getByText('AQI 450')).toBeInTheDocument();
  });

  it('renders Skeleton loading placeholder', () => {
    const { container } = render(<Skeleton width="120px" height="20px" />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('renders ConvergenceChart with multi-round history', () => {
    const data = [
      { round: 1, globalAcc: 0.65, delhiAcc: 0.60, punjabAcc: 0.62, loss: 0.45 },
      { round: 2, globalAcc: 0.78, delhiAcc: 0.72, punjabAcc: 0.75, loss: 0.32 },
    ];
    render(<ConvergenceChart data={data} title="Model Accuracy" />);
    expect(screen.getByText('Model Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Global Aggregator')).toBeInTheDocument();
  });
});

describe('API Client Smoke Tests', () => {
  it('resolves API base URL fallback', () => {
    expect(typeof API_BASE).toBe('string');
    expect(API_BASE.length).toBeGreaterThan(0);
  });

  it('stores and retrieves auth tokens correctly', () => {
    setAuthToken('test-bearer-token-prana');
    expect(getAuthToken()).toBe('test-bearer-token-prana');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });

  it('keeps CPCB AQI monotonic across the published 30–31 concentration gap', () => {
    expect(computeCpcbAqi(30)).toBe(50);
    expect(computeCpcbAqi(30.5)).toBe(51);
    expect(computeCpcbAqi(31)).toBe(51);
  });
});
