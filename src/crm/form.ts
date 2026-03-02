import { z } from 'zod';

const EventHandlerSchema = z
  .object({
    EventName: z
      .string()
      .describe('Name of the event, e.g., onload, onsave, etc.'),
    FunctionName: z
      .string()
      .describe('Name of the JavaScript function to call.'),
    LibraryName: z
      .string()
      .describe(
        'Name of the JavaScript library where the function is defined.',
      ),
    Parameters: z
      .string()
      .describe('Parameters to pass to the function, if any.'),
    PassExecutionContext: z
      .boolean()
      .describe(
        'Indicates whether to pass the execution context to the function.',
      ),
    Enabled: z
      .boolean()
      .describe('Indicates whether the event handler is enabled.'),
    //   AttributeName: null;
    //   ControlId: null;
    //   Relationship: null;
    //   BehaviorInBulkEditForm: null;
  })
  .strict();

type EventHandler = z.infer<typeof EventHandlerSchema>;

const SectionControlParameterSchema = z
  .object({
    Name: z.string(),
    Value: z.string(),
    TargetEntities: z.unknown(),
    StreamObjects: z.unknown(),
  })
  .strict();

type SectionControlParameter = z.infer<typeof SectionControlParameterSchema>;

const SectionControlSchema = z
  .object({
    UniqueId: z.string(),
    DataFieldName: z.string().nullish(),
    ClassId: z.string(),
    Parameters: z.array(SectionControlParameterSchema).nullish(),
    Disabled: z.boolean(),
    ControlLayout: z.number(),
    RequiredLevel: z.number(),
    Type: z.number(),
    IsUnbound: z.boolean(),
    IsRequired: z.boolean(),
    EventHandlers: z.array(EventHandlerSchema).optional(),
    relationship: z.unknown(),
    Name: z.unknown(),
    Id: z.string().nullable(),
    Label: z.string().nullable(),
    ShowLabel: z.boolean(),
    Visible: z.boolean(),
    LabelId: z.string().nullable(),
  })
  .strict();

type SectionControl = z.infer<typeof SectionControlSchema>;

const SectionCellSchema = z
  .object({
    ColSpan: z.number(),
    RowSpan: z.number(),
    AutoExpand: z.boolean(),
    IsInFirstColumnOfSection: z.boolean(),
    IsInLastColumnOfSection: z.boolean(),
    Locklevel: z.number(),
    UserSpacer: z.boolean(),
    IsPreviewCell: z.boolean(),
    IsStreamCell: z.boolean(),
    IsChartCell: z.boolean(),
    IsTileCell: z.boolean(),
    Control: SectionControlSchema,
    AvailableForPhone: z.boolean(),
    Name: z.null(),
    Id: z.string(),
    Label: z.string().nullable(),
    ShowLabel: z.boolean(),
    Visible: z.boolean(),
    LabelId: z.string().nullable(),
  })
  .strict();

type SectionCell = z.infer<typeof SectionCellSchema>;

const SectionRowSchema = z
  .object({
    Height: z.string().nullish(),
    Visible: z.boolean(),
    Cells: z.array(SectionCellSchema),
  })
  .strict();

type SectionRow = z.infer<typeof SectionRowSchema>;

const SectionSchema = z
  .object({
    AvailableForPhone: z.boolean(),
    CellLabel: z
      .object({
        Width: z.number(),
        Alignment: z.number(),
        Position: z.number(),
      })
      .strict(),
    Id: z.string(),
    Label: z.string().nullable(),
    LabelId: z.string().nullable(),
    Name: z.string(),
    LabelWidth: z.number(),
    ShowLabel: z.boolean(),
    Visible: z.boolean(),
    Columns: z.number(),
    Rows: z.array(SectionRowSchema),
  })
  .strict();

type Section = z.infer<typeof SectionSchema>;

const TabColumnSchema = z
  .object({
    Id: z.string().nullable(),
    Label: z.string().nullable(),
    Name: z.string().nullable(),
    LabelId: z.string().nullable(),
    ShowLabel: z.boolean(),
    Visible: z.boolean(),
    Width: z.string(),
    Sections: z.array(SectionSchema),
  })
  .strict();

type TabColumn = z.infer<typeof TabColumnSchema>;

const TabSchema = z
  .object({
    AvailableForPhone: z.boolean(),
    ContentType: z.enum(['cardSections']),
    Id: z.string(),
    Label: z.string().nullable(),
    LabelId: z.string().nullable(),
    ShowLabel: z.boolean(),
    Name: z.string(),
    Visible: z.boolean(),
    EventHandlers: z.array(EventHandlerSchema),
    Columns: z.array(TabColumnSchema),
  })
  .strict();

type Tab = z.infer<typeof TabSchema>;

export const FormDefinationSchema = z
  .object({
    EventHandlers: z.array(EventHandlerSchema),
    FormLibraries: z.array(z.string()),
    Tabs: z.array(TabSchema),
  })
  .strict();

export type FormDefination = z.infer<typeof FormDefinationSchema>;

function transformEventHandler(handler: any): EventHandler {
  return {
    EventName: handler.EventName,
    FunctionName: handler.FunctionName,
    LibraryName: handler.LibraryName,
    Parameters: handler.Parameters,
    PassExecutionContext: handler.PassExecutionContext,
    Enabled: handler.Enabled,
  };
}

export function transformJsonToFormDefinition(json: string): FormDefination {
  const jsonObject = JSON.parse(json);

  const eventHandlers = jsonObject.EventHandlers.$values.map((handler: any) =>
    transformEventHandler(handler),
  );

  const formLibraries = jsonObject.FormLibraries.$values.map(
    (library: any) => library,
  );

  const tabs = jsonObject.Tabs.$values.map((tab: any): Tab => {
    const columns = tab.Columns.$values.map((column: any): TabColumn => {
      const sections = column.Sections.$values.map((section: any): Section => {
        const rows = section.Rows.$values.map((row: any): SectionRow => {
          const cells = row.Cells.$values.map((cell: any): SectionCell => {
            const parameters = cell.Control.Parameters?.$values.map(
              (param: any): SectionControlParameter => ({
                Name: param.Name,
                StreamObjects: param.StreamObjects,
                TargetEntities: param.TargetEntities,
                Value: param.Value,
              }),
            );

            const control: SectionControl = {
              ClassId: cell.Control.ClassId,
              ControlLayout: cell.Control.ControlLayout,
              DataFieldName: cell.Control.DataFieldName,
              Disabled: cell.Control.Disabled,
              EventHandlers: cell.Control.EventHandlers?.$values.map(
                (handler: any) => transformEventHandler(handler),
              ),
              Id: cell.Control.Id,
              IsRequired: cell.Control.IsRequired,
              IsUnbound: cell.Control.IsUnbound,
              Label: cell.Control.Label,
              LabelId: cell.Control.LabelId,
              Name: cell.Control.Name,
              Parameters: parameters,
              relationship: cell.Control.relationship,
              RequiredLevel: cell.Control.RequiredLevel,
              ShowLabel: cell.Control.ShowLabel,
              Type: cell.Control.Type,
              UniqueId: cell.Control.UniqueId,
              Visible: cell.Control.Visible,
            };

            return {
              AutoExpand: cell.AutoExpand,
              AvailableForPhone: cell.AvailableForPhone,
              ColSpan: cell.ColSpan,
              IsChartCell: cell.IsChartCell,
              IsInFirstColumnOfSection: cell.IsInFirstColumnOfSection,
              Id: cell.Id,
              IsInLastColumnOfSection: cell.IsInLastColumnOfSection,
              IsPreviewCell: cell.IsPreviewCell,
              IsStreamCell: cell.IsStreamCell,
              IsTileCell: cell.IsTileCell,
              Label: cell.Label,
              LabelId: cell.LabelId,
              Locklevel: cell.Locklevel,
              Name: cell.Name,
              RowSpan: cell.RowSpan,
              ShowLabel: cell.ShowLabel,
              UserSpacer: cell.UserSpacer,
              Visible: cell.Visible,
              Control: control,
            };
          });

          return {
            Height: row.Height,
            Visible: row.Visible,
            Cells: cells,
          };
        });

        return {
          AvailableForPhone: section.AvailableForPhone,
          CellLabel: {
            Alignment: section.CellLabel.Alignment,
            Position: section.CellLabel.Position,
            Width: section.CellLabel.Width,
          },
          Id: section.Id,
          Label: section.Label,
          LabelId: section.LabelId,
          Name: section.Name,
          LabelWidth: section.LabelWidth,
          ShowLabel: section.ShowLabel,
          Visible: section.Visible,
          Columns: section.Columns,
          Rows: rows,
        };
      });

      return {
        Id: column.Id,
        Label: column.Label,
        Name: column.Name,
        LabelId: column.LabelId,
        ShowLabel: column.ShowLabel,
        Visible: column.Visible,
        Width: column.Width,
        Sections: sections,
      };
    });

    return {
      AvailableForPhone: tab.AvailableForPhone,
      ContentType: tab.ContentType,
      Id: tab.Id,
      Label: tab.Label,
      LabelId: tab.LabelId,
      ShowLabel: tab.ShowLabel,
      Name: tab.Name,
      Visible: tab.Visible,
      EventHandlers: tab.EventHandlers.$values.map((handler: any) =>
        transformEventHandler(handler),
      ),
      Columns: columns,
    };
  });

  return {
    EventHandlers: eventHandlers,
    FormLibraries: formLibraries,
    Tabs: tabs,
  };
}
