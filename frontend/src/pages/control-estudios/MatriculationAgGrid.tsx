import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridApi, GridReadyEvent, CellContextMenuEvent, SelectionChangedEvent, ColumnResizedEvent, ColumnMovedEvent, SortChangedEvent, RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import {
  buildColumnDefs,
  type MatriculationRow,
  type EnrollStructureEntry,
  type ColumnCallbacks,
  type TempData,
  type GuardianProfile,
} from './matriculationColumns';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';

interface MatriculationAgGridProps extends ColumnCallbacks {
  rowData: MatriculationRow[];
  structure: EnrollStructureEntry[];
  questions: EnrollmentQuestionResponse[];
  canManageVisibility: boolean;
  visibleColumnKeys: string[];
  selectedRowIds: number[];
  onSelectionChanged: (ids: number[]) => void;
  height: number;
}

const STORAGE_KEY = 'matriculation-grid-state-v1';

interface GridState {
  columnWidths: Record<string, number>;
  columnOrder: string[];
  sortState: { colId: string; sort: 'asc' | 'desc' } | null;
}

function loadGridState(): GridState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { columnWidths: {}, columnOrder: [], sortState: null };
}

function saveGridState(state: GridState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const MatriculationAgGrid: React.FC<MatriculationAgGridProps> = ({
  rowData,
  structure,
  questions,
  canManageVisibility,
  visibleColumnKeys,
  selectedRowIds,
  onSelectionChanged,
  height,
  onUpdateField,
  onUpdateGuardianField,
  onUpdateAnswer,
  onToggleInscription,
  onContextMenu,
}) => {
  const gridRef = useRef<AgGridReact<MatriculationRow>>(null);
  const [gridApi, setGridApi] = useState<GridApi<MatriculationRow> | null>(null);
  const gridStateRef = useRef<GridState>(loadGridState());

  // Keep the latest callbacks in a ref so that `columnDefs` never has to be
  // rebuilt when the parent re-renders with new function identities. Rebuilding
  // columnDefs makes AG-Grid reset every column, which causes a visible
  // "stretch" of the table (e.g. when opening the custom context menu).
  const callbacksRef = useRef<ColumnCallbacks>({
    onUpdateField,
    onUpdateGuardianField,
    onUpdateAnswer,
    onToggleInscription,
    onContextMenu,
  });
  callbacksRef.current = {
    onUpdateField,
    onUpdateGuardianField,
    onUpdateAnswer,
    onToggleInscription,
    onContextMenu,
  };

  const callbacks = useMemo<ColumnCallbacks>(
    () => ({
      onUpdateField: (...args) => callbacksRef.current.onUpdateField(...args),
      onUpdateGuardianField: (...args) => callbacksRef.current.onUpdateGuardianField(...args),
      onUpdateAnswer: (...args) => callbacksRef.current.onUpdateAnswer(...args),
      onToggleInscription: (...args) => callbacksRef.current.onToggleInscription(...args),
      onContextMenu: (...args) => callbacksRef.current.onContextMenu(...args),
    }),
    []
  );

  const columnDefs = useMemo(
    () => buildColumnDefs({ structure, questions, canManageVisibility, visibleColumnKeys, callbacks }),
    [structure, questions, canManageVisibility, visibleColumnKeys, callbacks]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      movable: true,
      editable: false,
      minWidth: 60,
      filter: false,
      suppressMovable: false,
    }),
    []
  );

  // Get row id for AG-Grid
  const getRowId = useCallback((params: { data: MatriculationRow }) => String(params.data.id), []);

  // Grid ready
  const onGridReady = useCallback((event: GridReadyEvent<MatriculationRow>) => {
    setGridApi(event.api);
    // Apply saved sort state
    const state = gridStateRef.current;
    if (state.sortState) {
      event.api.applyColumnState({
        state: [{ colId: state.sortState.colId, sort: state.sortState.sort }],
        applyOrder: true,
      });
    }
  }, []);

  // Selection changed
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<MatriculationRow>) => {
      const selected = event.api.getSelectedRows();
      onSelectionChanged(selected.map(r => r.id));
    },
    [onSelectionChanged]
  );

  // Toggle selection on left-click: click on unselected row → select it,
  // click on selected row → deselect it. Multiple selection is allowed
  // (clicking never clears other selections).
  const handleRowClicked = useCallback((event: RowClickedEvent<MatriculationRow>) => {
    const node = event.node;
    if (!node) return;
    // Toggle this row only, without clearing the rest.
    node.setSelected(!node.isSelected(), false, false);
  }, []);

  // Escape key → deselect all rows
  useEffect(() => {
    if (!gridApi) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        gridApi.deselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridApi]);

  // Context menu
  const handleCellContextMenu = useCallback(
    (event: CellContextMenuEvent<MatriculationRow>) => {
      // Suppress the browser's native context menu
      event.event?.preventDefault();
      event.event?.stopPropagation();
      if (!event.data) return;
      // Select the row on right-click
      event.api.forEachNode(node => {
        if (node.data?.id === event.data!.id) node.setSelected(true, false, true);
      });
      const mouseEvent = event.event as MouseEvent | undefined;
      onContextMenu(event.data.id, mouseEvent?.clientX ?? 0, mouseEvent?.clientY ?? 0);
    },
    [onContextMenu]
  );

  // Column resized → save widths
  const handleColumnResized = useCallback((event: ColumnResizedEvent) => {
    if (event.finished && event.source !== 'sizeColumnsToFit') {
      const state = gridStateRef.current;
      event.api.getColumnState().forEach(cs => {
        if (cs.width && cs.colId) {
          state.columnWidths[cs.colId] = cs.width;
        }
      });
      saveGridState(state);
    }
  }, []);

  // Column moved → save order
  const handleColumnMoved = useCallback((event: ColumnMovedEvent) => {
    if (event.finished) {
      const state = gridStateRef.current;
      state.columnOrder = event.api.getColumnState().map(cs => cs.colId);
      saveGridState(state);
    }
  }, []);

  // Sort changed → save sort
  const handleSortChanged = useCallback((event: SortChangedEvent) => {
    const sortModel = event.api.getColumnState().filter(cs => cs.sort);
    const state = gridStateRef.current;
    if (sortModel.length > 0) {
      state.sortState = { colId: sortModel[0].colId, sort: sortModel[0].sort as 'asc' | 'desc' };
    } else {
      state.sortState = null;
    }
    saveGridState(state);
  }, []);

  // Apply saved column widths on grid ready or when column defs change
  useEffect(() => {
    if (!gridApi) return;
    const state = gridStateRef.current;
    if (Object.keys(state.columnWidths).length > 0) {
      const colState = gridApi.getColumnState().map(cs => {
        const savedWidth = state.columnWidths[cs.colId];
        return savedWidth ? { ...cs, width: savedWidth } : cs;
      });
      gridApi.applyColumnState({ state: colState, applyOrder: false });
    }
  }, [gridApi, columnDefs]);

  // Sync selection from parent
  useEffect(() => {
    if (!gridApi) return;
    const currentSelected = new Set(gridApi.getSelectedRows().map(r => r.id));
    const targetSelected = new Set(selectedRowIds);
    // Only update if different
    if (currentSelected.size === targetSelected.size && [...currentSelected].every(id => targetSelected.has(id))) return;
    gridApi.forEachNode(node => {
      if (node.data) {
        node.setSelected(targetSelected.has(node.data.id), false, false);
      }
    });
  }, [gridApi, selectedRowIds]);

  return (
    <AgGridProvider modules={[AllCommunityModule]}>
      <div
        className="ag-theme-quartz matriculation-grid"
        style={{ width: '100%', height }}
        onContextMenu={e => e.preventDefault()}
      >
        <AgGridReact<MatriculationRow>
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          rowSelection="multiple"
          suppressRowClickSelection
          stopEditingWhenCellsLoseFocus
          preventDefaultOnContextMenu
          animateRows
          onGridReady={onGridReady}
          onSelectionChanged={handleSelectionChanged}
          onRowClicked={handleRowClicked}
          onCellContextMenu={handleCellContextMenu}
          onColumnResized={handleColumnResized}
          onColumnMoved={handleColumnMoved}
          onSortChanged={handleSortChanged}
        />
      </div>
    </AgGridProvider>
  );
};

export default MatriculationAgGrid;
