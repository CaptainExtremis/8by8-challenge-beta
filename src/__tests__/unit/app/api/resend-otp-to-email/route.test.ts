import { POST } from '@/app/api/resend-otp-to-email/route';
import { NextRequest } from 'next/server';
import { serverContainer } from '@/services/server/container';
import { SERVER_SERVICE_KEYS } from '@/services/server/keys';
import { ServerError } from '@/errors/server-error';
import { Builder } from 'builder-pattern';
import { saveActualImplementation } from '@/utils/test/save-actual-implementation';
import type { Auth } from '@/services/server/auth/auth';
import type { ICookies } from '@/services/server/cookies/i-cookies';

describe('POST', () => {
  const getActualService = saveActualImplementation(serverContainer, 'get');

  it(`sets a cookie to store the email address to which the OTP was sent and 
  then returns a status code of 200 if the user was successfully 
  emailed.`, async () => {
    const userEmail = 'user@example.com';
    const setEmailForSignIn = jest.fn();

    const containerSpy = jest
      .spyOn(serverContainer, 'get')
      .mockImplementation(key => {
        if (key.name === SERVER_SERVICE_KEYS.Auth.name) {
          return Builder<Auth>()
            .sendOTPToEmail(() => {
              return Promise.resolve();
            })
            .build();
        } else if (key.name === SERVER_SERVICE_KEYS.Cookies.name) {
          return Builder<ICookies>()
            .setEmailForSignIn(setEmailForSignIn)
            .build();
        }

        return getActualService(key);
      });

    const request = new NextRequest(
      'https://challenge.8by8.us/api/resend-otp-to-email',
      {
        method: 'POST',
        body: JSON.stringify({
          email: userEmail,
        }),
      },
    );

    const response = await POST(request);
    expect(setEmailForSignIn).toHaveBeenCalledWith(userEmail);
    expect(response.status).toBe(200);

    containerSpy.mockRestore();
  });

  it(`returns a response with a status code of 400 if the request cannot be 
  parsed.`, async () => {
    const request = new NextRequest(
      'https://challenge.8by8.us/api/resend-otp-to-email',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it(`returns a response with a status code matching that of a ServerError 
  thrown by the Auth service.`, async () => {
    const containerSpy = jest.spyOn(serverContainer, 'get');

    containerSpy.mockImplementation(key => {
      if (key.name === SERVER_SERVICE_KEYS.Auth.name) {
        return Builder<Auth>()
          .sendOTPToEmail(() => {
            throw new ServerError('Too many requests.', 429);
          })
          .build();
      }

      return getActualService(key);
    });

    const request = new NextRequest(
      'https://challenge.8by8.us/api/resend-otp-to-email',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
        }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(429);

    const responseBody = await response.json();
    expect(responseBody.error).toBe('Too many requests.');

    containerSpy.mockRestore();
  });
});