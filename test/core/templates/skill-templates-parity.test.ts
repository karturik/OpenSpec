import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  type SkillTemplate,
  getApplyChangeSkillTemplate,
  getArchiveChangeSkillTemplate,
  getBulkArchiveChangeSkillTemplate,
  getContinueChangeSkillTemplate,
  getExploreSkillTemplate,
  getFeedbackSkillTemplate,
  getFfChangeSkillTemplate,
  getNewChangeSkillTemplate,
  getOnboardSkillTemplate,
  getOpsxApplyCommandTemplate,
  getOpsxArchiveCommandTemplate,
  getOpsxBulkArchiveCommandTemplate,
  getOpsxContinueCommandTemplate,
  getOpsxExploreCommandTemplate,
  getOpsxFfCommandTemplate,
  getOpsxNewCommandTemplate,
  getOpsxOnboardCommandTemplate,
  getOpsxSyncCommandTemplate,
  getOpsxProposeCommandTemplate,
  getOpsxProposeSkillTemplate,
  getProposeTeamSkillTemplate,
  getOpsxProposeTeamCommandTemplate,
  getExploreTeamSkillTemplate,
  getOpsxExploreTeamCommandTemplate,
  getApplyTeamSkillTemplate,
  getOpsxApplyTeamCommandTemplate,
  getVerifyTeamSkillTemplate,
  getOpsxVerifyTeamCommandTemplate,
  getOpsxVerifyCommandTemplate,
  getSyncSpecsSkillTemplate,
  getVerifyChangeSkillTemplate,
} from '../../../src/core/templates/skill-templates.js';
import { generateSkillContent } from '../../../src/core/shared/skill-generation.js';

const EXPECTED_FUNCTION_HASHES: Record<string, string> = {
  getExploreSkillTemplate: 'e2765fae6c2e960f4ce07058cfdaa547ff3435d454eacd5e924e38139e97ad52',
  getNewChangeSkillTemplate: 'b0c26f0b65380062e586505c08c72230e59dccea89e6acca7b673f01cba70d5a',
  getContinueChangeSkillTemplate: 'fbc6c379ed3dd39f59f52b10584b8df5b1dc08b5422bcf1c6d6255a944d22a11',
  getApplyChangeSkillTemplate: 'e746f230c2513a5fd40842bde494bb3cdb3c5f7c1bcece101f92090983d4ff55',
  getFfChangeSkillTemplate: '50e68fbb49b76d2690b614bffa9e6210e45539fb74419fc2e4311158b6d38485',
  getSyncSpecsSkillTemplate: '9f02b41227db70875b89eefeb275c769142607dc5b2593f4e606794aed2fdbad',
  getOnboardSkillTemplate: '4f4b60fea6e3fc7d2185815b2808fad51535fdd00cd4401b32d1536f32fa2b6d',
  getOpsxExploreCommandTemplate: '4d5e64e3ede6703113cf2fd23b797371ef2407b702478b4f7240fc81cbf2d3a5',
  getOpsxNewCommandTemplate: '757f72e2d9a1a6794b2188704fd39dd2ab65428899b4b361c76cc15a5e4f2ccc',
  getOpsxContinueCommandTemplate: '62f8863edda2bfe4e210f8bc3095fd4369aaaaf7772a5cba9602d0f0bca1d0c9',
  getOpsxApplyCommandTemplate: '812feefd32a4d9d468e03e456d06e3d2d08d1118d29cce4911f0be59cdd30bfc',
  getOpsxFfCommandTemplate: 'f775b242bcfd56594c431c7f31a0129208a1bacfdb2427074d412543072ef7ca',
  getArchiveChangeSkillTemplate: 'bdf022ae2cdef1feef4d641a068bef3a7fc5d98a323f7ce9f77ac578fe8d20c6',
  getBulkArchiveChangeSkillTemplate: 'fdb1715804e86de85be96222b8efeb9d5b350c6d5c19e343e244655deff8e62b',
  getOpsxSyncCommandTemplate: '4c8118afaea79ff4fed3d946c88e6a7abbba904a5fbf643e4372da1e3735a467',
  getVerifyChangeSkillTemplate: '3c5dda8b49ba00f50b5bae7f04763dd00cc00a05e5f1d8a2068ad7fb701d8165',
  getOpsxArchiveCommandTemplate: '5181ec2f59c9f0f3376e61d952ed4be976cbd01595b6b0d5e67466c8bd6bac6d',
  getOpsxOnboardCommandTemplate: '57c1f3e2590bda8f47818bab1d528456c1b8a9a7501f63ab9e2115e0cfaf6f35',
  getOpsxBulkArchiveCommandTemplate: 'b76c421023ccb5a12867c349f27cdb186234b692c1811980fb94127567bdabda',
  getOpsxVerifyCommandTemplate: '9a7a3f9e5bc3d0c0878b1a4493efbbb38729597d9b9be78f63284cc2da7c20c3',
  getOpsxProposeSkillTemplate: 'bae22279f8c7f711a8d5c5289551551d48197ddf5a99b695d96fff5339e08a49',
  getOpsxProposeCommandTemplate: '870ab824c2aeb825fe3fe161a1f223633b4fff308ecaeb8197cbf309db2ddf02',
  getFeedbackSkillTemplate: 'd7d83c5f7fc2b92fe8f4588a5bf2d9cb315e4c73ec19bcd5ef28270906319a0d',
  getProposeTeamSkillTemplate: '7e52721ca523fd1bfd1e344315ec2157661f023887300a03b2fed0ed757343c4',
  getOpsxProposeTeamCommandTemplate: '9f8683207fdebde9463c84efa00bf08b4bc60a16573c2b22af545aed34edbf17',
  getExploreTeamSkillTemplate: '2646971486bc2fed77ffcb8ef494a05ee3699ea17bdf84c622a482caccbfec9f',
  getOpsxExploreTeamCommandTemplate: '77e300aa9227922fecacf43bc3b60e2a9c04e9e5820763b925e244fd9752f877',
  getApplyTeamSkillTemplate: '5fe31a0a16c98aa6279843ad42f8ffbe1a189bb713bf707d7bec8f3db6469e6b',
  getOpsxApplyTeamCommandTemplate: 'ca889847f6d85fd2b5b54524fa8a377a15eac1c76b9132039cdbb08e8633944c',
  getVerifyTeamSkillTemplate: 'cb62d4370d77d23863a65a52ca0982c82700561447cd0f58b98cd089b994ee1c',
  getOpsxVerifyTeamCommandTemplate: 'dc40077336f2c2fe1997e9de7b03747e37f1be732260b8a0b0b7ab3263381f00',
};

const EXPECTED_GENERATED_SKILL_CONTENT_HASHES: Record<string, string> = {
  'openspec-explore': '28d900ef82b325beb65e69ee6435949adcfdf14a4314638e7006e6dc359b92d4',
  'openspec-new-change': 'c99989810f982d72eefc74a35f2282b71f1956f23f61b83aaa58fa3dd921716f',
  'openspec-continue-change': 'c00e2a60f79cd60197094cc59762babe5ee6a2dc1e859a0ede3f436a775ccecf',
  'openspec-apply-change': 'd849442efd925b9247651e254a5cd696945321610cca5a9432ad420430554548',
  'openspec-ff-change': '9d9b1995b6f4adb3da570676f7d11fee4cd1cf6c5df8ec83c033e02783a544df',
  'openspec-sync-specs': '2e0f67ec6fadffc6107b4b1a28eef23a99a6649e5fae706897ea1dd9deb852a8',
  'openspec-archive-change': '8d14af2c8b2e4358308ac9fc14f75db42a4b41a07e175825035852a82479793e',
  'openspec-bulk-archive-change': '16207683996b1952559cd4e33463f28fb097761f2c5d912107733d01a90d3f2f',
  'openspec-verify-change': 'a2acecd0c2b4e57080a314e5e7a093e0688293c37e446eb45d378f5050058550',
  'openspec-onboard': 'b924ea3c97543ebb7ee82c5f194afe7ce87a521c32b85616f445240ab33a02ab',
  'openspec-propose': '56aa526fe1e9fac956ad3ad570a3a259d27f54b05086940d85af136a62069292',
  'openspec-propose-team': '6827ac91515f7f82d3fa1a8ac0e6e6fb9487ca02f7227956134df9ff4b73f1c7',
  'openspec-explore-team': 'b29db1cfc0d2fafd3663e4d91f1b82633a195a3208a289abc6e72c497a830812',
  'openspec-apply-team': '23ebe1d4a6820ee875e2f91d5f27763b3d17953e6cf260ae975005d458fbe086',
  'openspec-verify-team': '348b303b26568db08eb578002c0e001f32d11b1e348f630cadb057084e433ae6',
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('skill templates split parity', () => {
  it('preserves all template function payloads exactly', () => {
    const functionFactories: Record<string, () => unknown> = {
      getExploreSkillTemplate,
      getNewChangeSkillTemplate,
      getContinueChangeSkillTemplate,
      getApplyChangeSkillTemplate,
      getFfChangeSkillTemplate,
      getSyncSpecsSkillTemplate,
      getOnboardSkillTemplate,
      getOpsxExploreCommandTemplate,
      getOpsxNewCommandTemplate,
      getOpsxContinueCommandTemplate,
      getOpsxApplyCommandTemplate,
      getOpsxFfCommandTemplate,
      getArchiveChangeSkillTemplate,
      getBulkArchiveChangeSkillTemplate,
      getOpsxSyncCommandTemplate,
      getVerifyChangeSkillTemplate,
      getOpsxArchiveCommandTemplate,
      getOpsxOnboardCommandTemplate,
      getOpsxBulkArchiveCommandTemplate,
      getOpsxVerifyCommandTemplate,
      getOpsxProposeSkillTemplate,
      getOpsxProposeCommandTemplate,
      getFeedbackSkillTemplate,
      getProposeTeamSkillTemplate,
      getOpsxProposeTeamCommandTemplate,
      getExploreTeamSkillTemplate,
      getOpsxExploreTeamCommandTemplate,
      getApplyTeamSkillTemplate,
      getOpsxApplyTeamCommandTemplate,
      getVerifyTeamSkillTemplate,
      getOpsxVerifyTeamCommandTemplate,
    };

    const actualHashes = Object.fromEntries(
      Object.entries(functionFactories).map(([name, fn]) => [name, hash(stableStringify(fn()))])
    );

    expect(actualHashes).toEqual(EXPECTED_FUNCTION_HASHES);
  });

  it('preserves generated skill file content exactly', () => {
    // Intentionally excludes getFeedbackSkillTemplate: skillFactories only models templates
    // deployed via generateSkillContent, while feedback is covered in function payload parity.
    const skillFactories: Array<[string, () => SkillTemplate]> = [
      ['openspec-explore', getExploreSkillTemplate],
      ['openspec-new-change', getNewChangeSkillTemplate],
      ['openspec-continue-change', getContinueChangeSkillTemplate],
      ['openspec-apply-change', getApplyChangeSkillTemplate],
      ['openspec-ff-change', getFfChangeSkillTemplate],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate],
      ['openspec-archive-change', getArchiveChangeSkillTemplate],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate],
      ['openspec-verify-change', getVerifyChangeSkillTemplate],
      ['openspec-onboard', getOnboardSkillTemplate],
      ['openspec-propose', getOpsxProposeSkillTemplate],
      ['openspec-propose-team', getProposeTeamSkillTemplate],
      ['openspec-explore-team', getExploreTeamSkillTemplate],
      ['openspec-apply-team', getApplyTeamSkillTemplate],
      ['openspec-verify-team', getVerifyTeamSkillTemplate],
    ];

    const actualHashes = Object.fromEntries(
      skillFactories.map(([dirName, createTemplate]) => [
        dirName,
        hash(generateSkillContent(createTemplate(), 'PARITY-BASELINE')),
      ])
    );

    expect(actualHashes).toEqual(EXPECTED_GENERATED_SKILL_CONTENT_HASHES);
  });

  it('guards unsupported workspace workflows from repo-local fallback edits', () => {
    const guardedSkills: Array<[string, () => SkillTemplate, string]> = [
      ['openspec-apply-change', getApplyChangeSkillTemplate, 'full workspace apply is not supported'],
      ['openspec-sync-specs', getSyncSpecsSkillTemplate, 'workspace spec sync is not supported'],
      ['openspec-archive-change', getArchiveChangeSkillTemplate, 'workspace archive is not supported'],
      ['openspec-bulk-archive-change', getBulkArchiveChangeSkillTemplate, 'workspace bulk archive is not supported'],
      ['openspec-verify-change', getVerifyChangeSkillTemplate, 'full workspace implementation verification is not supported'],
    ];

    for (const [dirName, createTemplate, guardText] of guardedSkills) {
      const content = generateSkillContent(createTemplate(), 'PARITY-BASELINE');

      expect(content, dirName).toContain('actionContext.mode: "workspace-planning"');
      expect(content, dirName).toContain(guardText);
      expect(content, dirName).not.toContain('openspec/changes/<name>');
      expect(content, dirName).not.toContain('mv openspec/changes');
    }
  });
});
