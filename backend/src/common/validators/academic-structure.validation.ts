import { EXPECTED_EDUCATION_LEVELS, EXPECTED_LEVEL_GRADES } from './academic-structure.constants';

export interface AcademicStructureValidationResult {
  institutionId: string;
  institutionName: string;
  educationLevels: number;
  levelGrades: number;
  expectedEducationLevels: number;
  expectedLevelGrades: number;
  status: 'HEALTHY' | 'INCOMPLETE' | 'INVALID';
  issues: string[];
}

export function buildAcademicValidationResult(params: {
  institutionId: string;
  institutionName: string;
  educationLevels: number;
  levelGrades: number;
}): AcademicStructureValidationResult {
  const issues: string[] = [];

  if (params.educationLevels !== EXPECTED_EDUCATION_LEVELS) {
    issues.push(
      `Expected ${EXPECTED_EDUCATION_LEVELS} EducationLevels, found ${params.educationLevels}`,
    );
  }
  if (params.levelGrades !== EXPECTED_LEVEL_GRADES) {
    issues.push(
      `Expected ${EXPECTED_LEVEL_GRADES} LevelGrades, found ${params.levelGrades}`,
    );
  }

  let status: AcademicStructureValidationResult['status'];
  if (params.educationLevels === EXPECTED_EDUCATION_LEVELS && params.levelGrades === EXPECTED_LEVEL_GRADES) {
    status = 'HEALTHY';
  } else if (params.educationLevels > EXPECTED_EDUCATION_LEVELS || params.levelGrades > EXPECTED_LEVEL_GRADES) {
    status = 'INVALID';
  } else {
    status = 'INCOMPLETE';
  }

  return {
    institutionId: params.institutionId,
    institutionName: params.institutionName,
    educationLevels: params.educationLevels,
    levelGrades: params.levelGrades,
    expectedEducationLevels: EXPECTED_EDUCATION_LEVELS,
    expectedLevelGrades: EXPECTED_LEVEL_GRADES,
    status,
    issues,
  };
}
