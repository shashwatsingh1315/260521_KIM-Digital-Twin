import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { resetIds } from '../../util/ids.js';
import { TwinContext } from '../TwinProvider.jsx';
import FactoryWizard from './FactoryWizard.jsx';
import { makeAssemblyLineFixture } from '../../fixtures/assemblyLine.js';

beforeEach(() => resetIds(0));

function renderWizard(overrides = {}) {
  const pause = vi.fn();
  const resume = vi.fn();
  const setConfig = vi.fn();
  const setSeed = vi.fn();
  const value = {
    config: overrides.config ?? makeAssemblyLineFixture(),
    setConfig,
    seed: 0,
    setSeed,
    twinHook: { pause, resume },
  };
  const onClose = vi.fn();
  const onOpenNetwork = vi.fn();
  const utils = render(
    <TwinContext.Provider value={value}>
      <FactoryWizard onClose={onClose} onOpenNetwork={onOpenNetwork} />
    </TwinContext.Provider>,
  );
  return { ...utils, pause, resume, setConfig, setSeed, onClose, onOpenNetwork };
}

describe('FactoryWizard', () => {
  test('mounts on the Start step and pauses the sim', () => {
    const { pause } = renderWizard();
    expect(screen.getByTestId('factory-wizard')).toBeTruthy();
    expect(screen.getByTestId('start-blank')).toBeTruthy();
    expect(pause).toHaveBeenCalled();
  });

  test('a blank start cannot be applied (no valid model yet)', () => {
    renderWizard();
    fireEvent.click(screen.getByTestId('start-blank'));
    // jump to review
    fireEvent.click(screen.getByTestId('wizard-step-review'));
    const apply = screen.getByTestId('wizard-apply');
    expect(apply.disabled).toBe(true);
    expect(screen.getByTestId('wiz-review-errors')).toBeTruthy();
  });

  test('editing the current (assembly) scenario loads in advanced mode and can be re-applied', () => {
    const { setConfig, resume, onClose } = renderWizard();
    fireEvent.click(screen.getByTestId('start-current'));
    // assemblyLine has two intakes → not a simple line → advanced mode.
    // The note is shown back on the Start step.
    fireEvent.click(screen.getByTestId('wizard-step-start'));
    expect(screen.getByTestId('wizard-advanced-note')).toBeTruthy();
    // It is nonetheless a valid config, so the Review apply is enabled.
    fireEvent.click(screen.getByTestId('wizard-step-review'));
    expect(screen.getByTestId('wiz-review-ok')).toBeTruthy();
    const apply = screen.getByTestId('wizard-apply');
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(setConfig).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('advanced-mode Line step deep-links to the Network panel', () => {
    const { onOpenNetwork, onClose } = renderWizard();
    fireEvent.click(screen.getByTestId('start-current'));
    fireEvent.click(screen.getByTestId('wizard-step-line'));
    fireEvent.click(screen.getByTestId('wiz-open-network'));
    expect(onOpenNetwork).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('guided build: a one-station line with one process becomes ready to apply', () => {
    const { setConfig } = renderWizard();
    fireEvent.click(screen.getByTestId('start-blank'));

    // Material
    fireEvent.click(screen.getByTestId('wiz-add-material'));

    // Process (defaults to a transform producing the first material)
    fireEvent.click(screen.getByTestId('wizard-step-processes'));
    fireEvent.click(screen.getByTestId('wiz-add-process'));

    // Station + a process slot
    fireEvent.click(screen.getByTestId('wizard-step-line'));
    fireEvent.click(screen.getByTestId('wiz-add-station'));
    const stationCard = screen.getByTestId('wiz-station-0');
    fireEvent.click(within(stationCard).getByText('+ add process'));

    // Order auto-fills its sequence from the line
    fireEvent.click(screen.getByTestId('wizard-step-orders'));
    fireEvent.click(screen.getByTestId('wiz-add-order'));

    // Review should now be valid and ready to apply
    fireEvent.click(screen.getByTestId('wizard-step-review'));
    const apply = screen.getByTestId('wizard-apply');
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(setConfig).toHaveBeenCalledTimes(1);
  });
});
