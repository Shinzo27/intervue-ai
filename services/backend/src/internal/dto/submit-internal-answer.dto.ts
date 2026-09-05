import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitInternalAnswerDto {
  /**
   * QuestionVersion id — runtime answers must reference the frozen
   * pipeline snapshot (QuestionVersion), never the mutable Question.
   */
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
