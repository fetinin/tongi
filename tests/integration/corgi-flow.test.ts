import { describe, test, expect } from '@jest/globals';

// T016: Integration test corgi sighting confirmation flow
// This test MUST FAIL until the actual API endpoints are implemented
describe('Corgi Sighting Confirmation Flow Integration', () => {
  const baseUrl = 'http://localhost:3000';

  test('should complete full corgi sighting confirmation flow', async () => {
    // Test scenario: User A reports a sighting, User B (buddy) confirms it
    const userAToken = 'mock-jwt-token-user-a';
    const userBToken = 'mock-jwt-token-user-b-buddy';

    // Step 1: User A reports a corgi sighting
    const sightingData = {
      corgiCount: 5,
    };

    const reportResponse = await fetch(`${baseUrl}/api/corgi/sightings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify(sightingData),
    });

    expect(reportResponse.ok).toBe(true);
    expect(reportResponse.status).toBe(201);

    const reportData = await reportResponse.json();
    expect(reportData).toHaveProperty('id');
    expect(reportData.status).toBe('pending');
    expect(reportData.corgiCount).toBe(5);

    const sightingId = reportData.id;

    // Step 2: User B (buddy) checks for pending confirmations
    const confirmationsResponse = await fetch(
      `${baseUrl}/api/corgi/confirmations`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userBToken}`,
        },
      }
    );

    expect(confirmationsResponse.ok).toBe(true);
    expect(confirmationsResponse.status).toBe(200);

    const confirmationsData = await confirmationsResponse.json();
    expect(confirmationsData).toHaveProperty('confirmations');
    expect(Array.isArray(confirmationsData.confirmations)).toBe(true);

    // Find the sighting that was just reported
    const pendingSighting = confirmationsData.confirmations.find(
      (confirmation: any) => confirmation.id === sightingId
    );
    expect(pendingSighting).toBeDefined();
    expect(pendingSighting.status).toBe('pending');
    expect(pendingSighting.corgiCount).toBe(5);

    // Step 3: User B confirms the sighting
    const confirmationData = {
      confirmed: true,
    };

    const confirmResponse = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify(confirmationData),
      }
    );

    expect(confirmResponse.ok).toBe(true);
    expect(confirmResponse.status).toBe(200);

    const confirmData = await confirmResponse.json();
    expect(confirmData.id).toBe(sightingId);
    expect(confirmData.status).toBe('confirmed');
    expect(confirmData.respondedAt).not.toBeNull();

    // Step 4: User A checks their sightings to see the confirmed status
    const userSightingsResponse = await fetch(
      `${baseUrl}/api/corgi/sightings`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userAToken}`,
        },
      }
    );

    expect(userSightingsResponse.ok).toBe(true);
    expect(userSightingsResponse.status).toBe(200);

    const userSightingsData = await userSightingsResponse.json();
    expect(userSightingsData).toHaveProperty('sightings');

    const confirmedSighting = userSightingsData.sightings.find(
      (sighting: any) => sighting.id === sightingId
    );
    expect(confirmedSighting).toBeDefined();
    expect(confirmedSighting.status).toBe('confirmed');
    expect(confirmedSighting.respondedAt).not.toBeNull();

    // Step 5: Verify the sighting no longer appears in pending confirmations
    const finalConfirmationsResponse = await fetch(
      `${baseUrl}/api/corgi/confirmations`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userBToken}`,
        },
      }
    );

    expect(finalConfirmationsResponse.ok).toBe(true);
    const finalConfirmationsData = await finalConfirmationsResponse.json();

    const stillPendingSighting = finalConfirmationsData.confirmations.find(
      (confirmation: any) => confirmation.id === sightingId
    );
    expect(stillPendingSighting).toBeUndefined();
  });

  test('should complete full corgi sighting denial flow', async () => {
    // Test scenario: User A reports a sighting, User B (buddy) denies it
    const userAToken = 'mock-jwt-token-user-a-2';
    const userBToken = 'mock-jwt-token-user-b-buddy-2';

    // Step 1: User A reports a corgi sighting
    const sightingData = {
      corgiCount: 2,
    };

    const reportResponse = await fetch(`${baseUrl}/api/corgi/sightings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify(sightingData),
    });

    expect(reportResponse.ok).toBe(true);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Step 2: User B denies the sighting
    const denialData = {
      confirmed: false,
    };

    const confirmResponse = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify(denialData),
      }
    );

    expect(confirmResponse.ok).toBe(true);
    const confirmData = await confirmResponse.json();
    expect(confirmData.status).toBe('denied');
    expect(confirmData.respondedAt).not.toBeNull();

    // Step 3: Verify User A can see the denied status
    const userSightingsResponse = await fetch(
      `${baseUrl}/api/corgi/sightings?status=denied`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userAToken}`,
        },
      }
    );

    expect(userSightingsResponse.ok).toBe(true);
    const userSightingsData = await userSightingsResponse.json();

    const deniedSighting = userSightingsData.sightings.find(
      (sighting: any) => sighting.id === sightingId
    );
    expect(deniedSighting).toBeDefined();
    expect(deniedSighting.status).toBe('denied');
  });

  test('should handle multiple pending confirmations correctly', async () => {
    const userAToken = 'mock-jwt-token-user-a-multi';
    const userBToken = 'mock-jwt-token-user-b-buddy-multi';

    // Step 1: User A reports multiple sightings
    const sightings = [{ corgiCount: 1 }, { corgiCount: 3 }, { corgiCount: 7 }];

    const sightingIds: number[] = [];

    for (const sightingData of sightings) {
      const reportResponse = await fetch(`${baseUrl}/api/corgi/sightings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify(sightingData),
      });

      expect(reportResponse.ok).toBe(true);
      const reportData = await reportResponse.json();
      sightingIds.push(reportData.id);
    }

    // Step 2: User B checks confirmations and sees all three
    const confirmationsResponse = await fetch(
      `${baseUrl}/api/corgi/confirmations`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userBToken}`,
        },
      }
    );

    expect(confirmationsResponse.ok).toBe(true);
    const confirmationsData = await confirmationsResponse.json();

    // Should find all three sightings in pending confirmations
    for (const sightingId of sightingIds) {
      const pendingSighting = confirmationsData.confirmations.find(
        (confirmation: any) => confirmation.id === sightingId
      );
      expect(pendingSighting).toBeDefined();
      expect(pendingSighting.status).toBe('pending');
    }

    // Step 3: User B confirms the first, denies the second, leaves third pending
    const confirmFirst = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingIds[0]}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({ confirmed: true }),
      }
    );
    expect(confirmFirst.ok).toBe(true);

    const denySecond = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingIds[1]}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({ confirmed: false }),
      }
    );
    expect(denySecond.ok).toBe(true);

    // Step 4: Check that only the third sighting remains in pending confirmations
    const finalConfirmationsResponse = await fetch(
      `${baseUrl}/api/corgi/confirmations`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userBToken}`,
        },
      }
    );

    expect(finalConfirmationsResponse.ok).toBe(true);
    const finalConfirmationsData = await finalConfirmationsResponse.json();

    const remainingPending = finalConfirmationsData.confirmations.filter(
      (confirmation: any) => sightingIds.includes(confirmation.id)
    );
    expect(remainingPending).toHaveLength(1);
    expect(remainingPending[0].id).toBe(sightingIds[2]);
    expect(remainingPending[0].status).toBe('pending');
  });

  test('should prevent unauthorized users from confirming sightings', async () => {
    const userAToken = 'mock-jwt-token-user-a-auth';
    const userCToken = 'mock-jwt-token-user-c-not-buddy';

    // Step 1: User A reports a sighting
    const sightingData = { corgiCount: 4 };

    const reportResponse = await fetch(`${baseUrl}/api/corgi/sightings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify(sightingData),
    });

    expect(reportResponse.ok).toBe(true);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Step 2: User C (not the buddy) tries to confirm the sighting
    const unauthorizedConfirmResponse = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userCToken}`,
        },
        body: JSON.stringify({ confirmed: true }),
      }
    );

    expect(unauthorizedConfirmResponse.ok).toBe(false);
    expect(unauthorizedConfirmResponse.status).toBe(404);

    const errorData = await unauthorizedConfirmResponse.json();
    expect(errorData).toHaveProperty('error', 'NOT_AUTHORIZED');

    // Step 3: Verify the sighting remains pending
    const userSightingsResponse = await fetch(
      `${baseUrl}/api/corgi/sightings`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userAToken}`,
        },
      }
    );

    expect(userSightingsResponse.ok).toBe(true);
    const userSightingsData = await userSightingsResponse.json();

    const sighting = userSightingsData.sightings.find(
      (s: any) => s.id === sightingId
    );
    expect(sighting).toBeDefined();
    expect(sighting.status).toBe('pending');
    expect(sighting.respondedAt).toBeNull();
  });

  test('should prevent double confirmation of sightings', async () => {
    const userAToken = 'mock-jwt-token-user-a-double';
    const userBToken = 'mock-jwt-token-user-b-buddy-double';

    // Step 1: User A reports a sighting
    const sightingData = { corgiCount: 6 };

    const reportResponse = await fetch(`${baseUrl}/api/corgi/sightings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify(sightingData),
    });

    expect(reportResponse.ok).toBe(true);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Step 2: User B confirms the sighting
    const firstConfirmResponse = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({ confirmed: true }),
      }
    );

    expect(firstConfirmResponse.ok).toBe(true);
    const firstConfirmData = await firstConfirmResponse.json();
    expect(firstConfirmData.status).toBe('confirmed');

    // Step 3: User B tries to confirm again (should fail)
    const secondConfirmResponse = await fetch(
      `${baseUrl}/api/corgi/confirm/${sightingId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({ confirmed: false }),
      }
    );

    expect(secondConfirmResponse.ok).toBe(false);
    expect(secondConfirmResponse.status).toBe(400);

    const errorData = await secondConfirmResponse.json();
    expect(errorData).toHaveProperty('error', 'ALREADY_RESPONDED');
  });
});
