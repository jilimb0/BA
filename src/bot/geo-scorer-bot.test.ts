import { describe, expect, it, vi } from 'vitest';
import {
  evaluateLocation,
  formatTelegramScoreMessage,
  handleGeoScorerUpdate,
} from './geo-scorer-bot.js';

describe('GeoScorerBot', () => {
  it('evaluates location correctly with fallback when POIs empty', () => {
    const result = evaluateLocation(41.7151, 44.8271, 'cafe');
    expect(result.score).toBeGreaterThanOrEqual(35);
    expect(result.score).toBeLessThanOrEqual(95);
    expect(['A', 'B', 'C', 'D']).toContain(result.rating);
    expect(result.recommendation).toBeTruthy();
    expect(result.metrics.directCompetition).toBeGreaterThanOrEqual(0);
  });

  it('evaluates location correctly with POIs provided', () => {
    const pois = [
      { lat: 41.715, lon: 44.827, category: 'cafe', group: 'catering' },
      { lat: 41.716, lon: 44.828, category: 'bank', group: 'finance' },
    ];
    const result = evaluateLocation(41.7151, 44.8271, 'cafe', 'catering', pois);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.metrics).toBeDefined();
  });

  it('formats telegram message with score and interactive links', () => {
    const result = evaluateLocation(41.7151, 44.8271, 'cafe');
    const { text, replyMarkup } = formatTelegramScoreMessage(
      41.7151,
      44.8271,
      'cafe',
      result,
      'https://ba.example.com',
    );

    expect(text).toContain('Business Analyzer — Location Intelligence');
    expect(text).toContain('41.71510');
    expect(text).toContain('Grade');
    expect(replyMarkup).toBeDefined();
  });

  it('handles /start update from user', async () => {
    const bot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    } as any;

    const update = {
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 9999, type: 'private' },
        from: { id: 12345, is_bot: false, first_name: 'Alex' },
        date: Math.floor(Date.now() / 1000),
        text: '/start',
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      9999,
      expect.stringContaining('Welcome to Business Analyzer'),
      expect.anything(),
    );
  });

  it('handles location message update from user', async () => {
    const bot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 124 }),
    } as any;

    const update = {
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 9999, type: 'private' },
        from: { id: 12345, is_bot: false, first_name: 'Alex' },
        date: Math.floor(Date.now() / 1000),
        location: {
          latitude: 41.7151,
          longitude: 44.8271,
        },
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      9999,
      expect.stringContaining('Location Intelligence'),
      expect.anything(),
    );
  });

  it('handles /score command with valid coordinates', async () => {
    const bot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 125 }),
    } as any;

    const update = {
      update_id: 3,
      message: {
        message_id: 12,
        chat: { id: 9999, type: 'private' },
        from: { id: 12345, is_bot: false, first_name: 'Alex' },
        date: Math.floor(Date.now() / 1000),
        text: '/score 41.6976 44.7978 restaurant',
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      9999,
      expect.stringContaining('restaurant'),
      expect.anything(),
    );
  });

  it('handles /rank command', async () => {
    const bot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 126 }),
    } as any;

    const update = {
      update_id: 4,
      message: {
        message_id: 13,
        chat: { id: 9999, type: 'private' },
        text: '/rank',
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      9999,
      expect.stringContaining('Top Commercial Hotspots Ranking'),
      expect.anything(),
    );
  });

  it('handles /stars command with invoice sending', async () => {
    const bot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 127 }),
      callApiUnsafe: vi.fn().mockResolvedValue({ ok: true }),
    } as any;

    const update = {
      update_id: 5,
      message: {
        message_id: 14,
        chat: { id: 9999, type: 'private' },
        text: '/stars',
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.callApiUnsafe).toHaveBeenCalledWith(
      'sendInvoice',
      expect.objectContaining({
        currency: 'XTR',
        prices: [{ label: 'Location Dossier', amount: 50 }],
      }),
    );
  });

  it('handles pre_checkout_query approval', async () => {
    const bot = {
      callApiUnsafe: vi.fn().mockResolvedValue({ ok: true }),
    } as any;

    const update = {
      update_id: 6,
      pre_checkout_query: {
        id: 'pcq_123',
        invoice_payload: 'ba_dossier_test',
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.callApiUnsafe).toHaveBeenCalledWith(
      'answerPreCheckoutQuery',
      expect.objectContaining({
        pre_checkout_query_id: 'pcq_123',
        ok: true,
      }),
    );
  });

  it('handles inline_query', async () => {
    const bot = {
      callApiUnsafe: vi.fn().mockResolvedValue({ ok: true }),
    } as any;

    const update = {
      update_id: 7,
      inline_query: {
        id: 'iq_456',
        query: '41.715 44.827',
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.callApiUnsafe).toHaveBeenCalledWith(
      'answerInlineQuery',
      expect.objectContaining({
        inline_query_id: 'iq_456',
        results: expect.any(Array),
      }),
    );
  });

  it('handles successful_payment confirmation', async () => {
    const bot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 128 }),
    } as any;

    const update = {
      update_id: 8,
      message: {
        message_id: 15,
        chat: { id: 9999, type: 'private' },
        successful_payment: {
          currency: 'XTR',
          total_amount: 50,
          invoice_payload: 'ba_dossier_test',
        },
      },
    } as any;

    const handled = await handleGeoScorerUpdate(update, bot);
    expect(handled).toBe(true);
    expect(bot.sendMessage).toHaveBeenCalledWith(
      9999,
      expect.stringContaining('Thank you for your Telegram Stars payment'),
      expect.anything(),
    );
  });
});
