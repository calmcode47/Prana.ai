import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { NeoCard } from '../../src/components/NeoCard';
import { NeoButton } from '../../src/components/NeoButton';
import { DualUnitChip } from '../../src/components/DualUnitChip';
import { StarburstBadge } from '../../src/components/StarburstBadge';
import { BottomNavBar } from '../../src/components/BottomNavBar';
import { Colors } from '../../src/theme/tokens';

describe('UI Component Library', () => {
  describe('NeoCard', () => {
    it('renders children and default style properties', () => {
      const { getByText } = render(
        <NeoCard backgroundColor={Colors.surfaceVanilla}>
          <Text>Atmospheric Observation</Text>
        </NeoCard>
      );
      expect(getByText('Atmospheric Observation')).toBeTruthy();
    });
  });

  describe('NeoButton', () => {
    it('renders children and handles press events', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <NeoButton onPress={onPressMock}>
          <Text>Scan Sky</Text>
        </NeoButton>
      );
      const btn = getByText('Scan Sky');
      expect(btn).toBeTruthy();
      fireEvent.press(btn);
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('does not trigger onPress when disabled', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <NeoButton onPress={onPressMock} disabled>
          <Text>Disabled Action</Text>
        </NeoButton>
      );
      fireEvent.press(getByText('Disabled Action'));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe('DualUnitChip', () => {
    it('renders dual units: PM2.5 mass and CPCB AQI index', () => {
      const { getByText } = render(
        <DualUnitChip
          massValue={184.2}
          aqiValue={345}
          aqiColor={Colors.aqiUnhealthy}
        />
      );
      expect(getByText('184.2')).toBeTruthy();
      expect(getByText('345')).toBeTruthy();
      expect(getByText('µg/m³ PM2.5')).toBeTruthy();
      expect(getByText('AQI')).toBeTruthy();
    });

    it('handles dash strings gracefully', () => {
      const { getAllByText } = render(
        <DualUnitChip
          massValue="—"
          aqiValue="—"
        />
      );
      const dashes = getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('StarburstBadge', () => {
    it('renders label correctly', () => {
      const { getByText } = render(
        <StarburstBadge label="LIVE SATELLITE" rotation="-2deg" />
      );
      expect(getByText('LIVE SATELLITE')).toBeTruthy();
    });
  });

  describe('BottomNavBar', () => {
    it('renders 5 primary navigation tabs and invokes onSelectTab', () => {
      const onSelectTabMock = jest.fn();

      const { getByText } = render(
        <BottomNavBar
          activeTab="dashboard"
          onSelectTab={onSelectTabMock}
        />
      );

      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Corridor')).toBeTruthy();
      expect(getByText('72h Plume')).toBeTruthy();
      expect(getByText('Alerts')).toBeTruthy();
      expect(getByText('Mesh')).toBeTruthy();

      // Tap on Corridor tab
      fireEvent.press(getByText('Corridor'));
      expect(onSelectTabMock).toHaveBeenCalledWith('corridor');

      // Tap on Alerts tab
      fireEvent.press(getByText('Alerts'));
      expect(onSelectTabMock).toHaveBeenCalledWith('alerts');
    });
  });
});
