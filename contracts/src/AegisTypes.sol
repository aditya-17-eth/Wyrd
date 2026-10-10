// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

library AegisTypes {
    enum Mode { Live, Synthetic }
    enum ResolutionStatus { None, Open, EvidenceCommitted, FinalYes, FinalNo, FinalInvalid }
    enum Outcome { None, Yes, No, Invalid }
    struct EventTerms {
        bytes32 specHash;
        bytes32 sourceConfigHash;
        uint64 observationStart;
        uint64 observationEnd;
        uint64 purchaseCutoff;
        uint64 minimumLeadTime;
        uint64 captureEligibleAt;
        uint64 resolutionDeadline;
        uint256 thresholdMilliMm;
        uint256 maxEventCoverage;
        uint256 maxBuyerCoverage;
        Mode mode;
        bytes32 fixtureManifestHash;
        bytes32 fixtureResponseHash;
        uint256 fixtureRainfallMilliMm;
        Outcome fixtureOutcome;
        string specificationURI;
    }
    struct Resolution {
        uint256 eventId;
        bytes32 specHash;
        bytes32 sourceConfigHash;
        ResolutionStatus status;
        Outcome outcome;
        bytes32 manifestHash;
        bytes32 responseHash;
        uint256 rainfallMilliMm;
        uint64 capturedAt;
        uint64 committedAt;
        uint64 finalizedAt;
        string evidenceURI;
    }
}
