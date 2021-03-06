//
// The MIT License (MIT)
//
// Copyright (c) 2014 Lorenzo Villani
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//

/** @module url-otpauth */

var url = require('url');

//
// Exception types
//

var ErrorType = {
    INVALID_ISSUER: 0,
    INVALID_LABEL: 1,
    INVALID_PROTOCOL: 2,
    MISSING_ACCOUNT_NAME: 3,
    MISSING_COUNTER: 4,
    MISSING_ISSUER: 5,
    MISSING_SECRET_KEY: 6,
    UNKNOWN_OTP: 7,
    INVALID_DIGITS: 8,
    UNKNOWN_ALGORITHM: 9
};

var PossibleDigits = [6, 8];

var PossibleAlgorithms = ["SHA1", "SHA256", "SHA512", "MD5"];

function OtpauthInvalidURL(errorType) {
    this.name = 'OtpauthInvalidURL';
    this.message = 'Given otpauth:// URL is invalid. (Error ' + errorType + ')';
    this.errorType = errorType;
}

OtpauthInvalidURL.prototype = new Error();
OtpauthInvalidURL.prototype.constructor = OtpauthInvalidURL;

//
// Code
//

module.exports = {
    /**
     * Parses an OTPAuth URI.
     *
     * Parses an URL as described in Google Authenticator's "KeyUriFormat" document (see:
     * [https://code.google.com/p/google-authenticator/wiki/KeyUriFormat](https://code.google.com/p/google-authenticator/wiki/KeyUriFormat))
     * and returns an object that contains the following properties:
     *
     * - `account`: The account name.
     * - `digits`: The number of digits of the resulting OTP. Default is 6 (six).
     * - `key`: The shared key in Base32 encoding.
     * - `issuer`: Provider or service this account is associated with. The default is the empty
     *   string.
     * - `type`: Either the string `hotp` or `totp`.
     *
     * OTP of type `hotp` have an additional `counter` field which contains the start value for the
     * HOTP counter. In all other cases this field is missing from the resulting object.
     *
     * @param rawUrl {string} The URI to parse.
     * @returns {Object} An object with properties described above.
     */
    parse: function parse(rawUrl) {
        var ret = {};

        //
        // Protocol
        //

        var parsed = url.parse(rawUrl, true);

        if (parsed.protocol !== 'otpauth:') {
            throw new OtpauthInvalidURL(ErrorType.INVALID_PROTOCOL);
        }

        //
        // Type
        //

        var otpAlgo = decodeURIComponent(parsed.host);

        if (otpAlgo !== 'hotp' && otpAlgo !== 'totp') {
            throw new OtpauthInvalidURL(ErrorType.UNKNOWN_OTP);
        }

        ret.type = otpAlgo;

        //
        // Label (contains account name, may contain issuer)
        //

        var label = decodeURIComponent(parsed.pathname.substring(1));
        var labelComponents = label.split(':');
        var issuer = '';
        var account = '';

        if (labelComponents.length === 1) {
            account = labelComponents[0];
        } else if (labelComponents.length === 2) {
            issuer = labelComponents[0];
            account = labelComponents[1];
        } else {
            throw new OtpauthInvalidURL(ErrorType.INVALID_LABEL);
        }

        if (account.length < 1) {
            throw new OtpauthInvalidURL(ErrorType.MISSING_ACCOUNT_NAME);
        }

        if ((labelComponents.length === 2) && (issuer.length < 1)) {
            throw new OtpauthInvalidURL(ErrorType.INVALID_ISSUER);
        }

        ret.account = account;

        //
        // Parameters
        //

        var parameters = parsed.query;

        // Secret key
        if (!parameters.secret) {
            throw new OtpauthInvalidURL(ErrorType.MISSING_SECRET_KEY);
        }

        ret.key = parameters.secret;

        // Issuer
//        if (parameters.issuer && issuer && (parameters.issuer !== issuer)) {
            // If present, it must be equal to the "issuer" specified in the label.
//            throw new OtpauthInvalidURL(ErrorType.INVALID_ISSUER);
//        }

        ret.issuer = issuer || parameters.issuer || '';

        // OTP digits
        ret.digits = 6;  // Default is 6

        if (parameters.digits) {
            var parsedDigits = parseInt(parameters.digits, 10);
            if (PossibleDigits.indexOf(parsedDigits) == -1) {
                throw new OtpauthInvalidURL(ErrorType.INVALID_DIGITS);
            } else {
                ret.digits = parsedDigits;
            }
        }

        // Algorithm to create hash
        if (parameters.algorithm) {
            if (PossibleAlgorithms.indexOf(parameters.algorithm) == -1) {
                throw new OtpauthInvalidURL(ErrorType.UNKNOWN_ALGORITHM);
            } else {
                // Optional 'algorithm' parameter.
                ret.algorithm = parameters.algorithm;
            }
        }

        // Period (only for TOTP)
        if (otpAlgo === 'totp') {
            // Optional 'period' parameter for TOTP.
            if (parameters.period) {
                ret.period = parseFloat(parameters.period);
            }
        }

        // Counter (only for HOTP)
        if (otpAlgo === 'hotp') {
            if (!parameters.counter) {
                // We require the 'counter' parameter for HOTP.
                throw new OtpauthInvalidURL(ErrorType.MISSING_COUNTER);
            } else {
                ret.counter = parseInt(parameters.counter, 10);
            }
        }

        return ret;
    },

    /**
     * Enumeration of all error types raised by `OtpauthInvalidURL`.
     */
    ErrorType: ErrorType,

    /**
     * Exception thrown whenever there's an error deconstructing an 'otpauth://' URI.
     *
     * You can query the `errorType` attribute to obtain the exact reason for failure. The
     * `errorType` attributes contains a value from the `ErrorType` enumeration.
     */
    OtpauthInvalidURL: OtpauthInvalidURL
};
