import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridApi, GridReadyEvent, CellContextMenuEvent, SelectionChangedEvent, ColumnResizedEvent, ColumnMovedEvent, SortChangedEvent, RowClickedEvent, CellMouseDownEvent, CellMouseOverEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import {
  buildColumnDefs,
  type MatriculationRow,
  type EnrollStructureEntry,
  type ColumnCallbacks,
  type VenezuelaState,
} from './matriculationColumns';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';

interface MatriculationAgGridProps extends ColumnCallbacks {
  rowData: MatriculationRow[];
  structure: EnrollStructureEntry[];
  questions: EnrollmentQuestionResponse[];
  canManageVisibility: boolean;
  visibleColumnKeys: string[];
  locations: VenezuelaState[];
  selectedRowIds: number[];
  onSelectionChanged: (ids: number[]) => void;
  height: number;
}

const STORAGE_KEY = 'matriculation-grid-state-v2';

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
  locations,
  selectedRowIds,
  onSelectionChanged,
  height,
  onUpdateField,
  onUpdateFields,
  onUpdateGuardianField,
  onUpdateGuardianFields,
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
    onUpdateFields,
    onUpdateGuardianField,
    onUpdateGuardianFields,
    onUpdateAnswer,
    onToggleInscription,
    onContextMenu,
  });
  callbacksRef.current = {
    onUpdateField,
    onUpdateFields,
    onUpdateGuardianField,
    onUpdateGuardianFields,
    onUpdateAnswer,
    onToggleInscription,
    onContextMenu,
  };

  const callbacks = useMemo<ColumnCallbacks>(
    () => ({
      onUpdateField: (...args) => callbacksRef.current.onUpdateField(...args),
      onUpdateFields: (...args) => callbacksRef.current.onUpdateFields(...args),
      onUpdateGuardianField: (...args) => callbacksRef.current.onUpdateGuardianField(...args),
      onUpdateGuardianFields: (...args) => callbacksRef.current.onUpdateGuardianFields(...args),
      onUpdateAnswer: (...args) => callbacksRef.current.onUpdateAnswer(...args),
      onToggleInscription: (...args) => callbacksRef.current.onToggleInscription(...args),
      onContextMenu: (...args) => callbacksRef.current.onContextMenu(...args),
    }),
    []
  );

  const columnDefs = useMemo(
    () => buildColumnDefs({ structure, questions, canManageVisibility, visibleColumnKeys, callbacks, locations }),
    [structure, questions, canManageVisibility, visibleColumnKeys, callbacks, locations]
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

  // --- Selection logic ---
  //   Simple click       → select only this row (deselect all others).
  //                        If it was already the only selected row, deselect.
  //   Ctrl/Cmd+click     → toggle this row without clearing others.
  //   Shift+click        → select range from last anchor to this row.
  //   Long-press         → toggle without clearing, then enter "drag-select"
  //                        mode: moving the pointer over other rows selects
  //                        them too, until the pointer is released.
  //   Escape             → deselect all.

  const lastSelectedIndexRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isDragSelectingRef = useRef(false);
  // When drag-selecting, this records whether we're selecting ('select')
  // or deselecting ('deselect') rows as the pointer moves.
  const dragModeRef = useRef<'select' | 'deselect'>('select');
  // AG-Grid with suppressRowClickSelection still toggles selection internally
  // on Ctrl+click before our handleRowClicked fires.  We capture the node's
  // selection state during mousedown (before AG-Grid modifies it) so we can
  // apply the correct toggle ourselves.
  const wasSelectedBeforeClickRef = useRef(false);

  // Clear any pending long-press timer on cleanup
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handleRowClicked = useCallback((event: RowClickedEvent<MatriculationRow>) => {
    // If a long-press or drag-select was triggered, the selection was already
    // handled in the mouse-down / mouse-over handlers — skip the click action.
    if (longPressTriggeredRef.current || isDragSelectingRef.current) {
      longPressTriggeredRef.current = false;
      isDragSelectingRef.current = false;
      return;
    }

    const node = event.node;
    if (!node) return;

    const mouseEvent = event.event as MouseEvent | undefined;
    const ctrl = !!mouseEvent?.ctrlKey || !!mouseEvent?.metaKey;
    const shift = !!mouseEvent?.shiftKey;

    const rowIndex = node.rowIndex ?? null;

    if (shift && lastSelectedIndexRef.current !== null && rowIndex !== null) {
      // Range selection: select all rows between anchor and current
      const api = event.api;
      const start = Math.min(lastSelectedIndexRef.current, rowIndex);
      const end = Math.max(lastSelectedIndexRef.current, rowIndex);
      api.forEachNode(n => {
        if (n.rowIndex !== null && n.rowIndex >= start && n.rowIndex <= end) {
          n.setSelected(true, false);
        }
      });
      return;
    }

    if (ctrl) {
      // AG-Grid already toggled the selection internally on Ctrl+mousedown.
      // We need to undo that and apply the correct toggle based on the
      // state captured before AG-Grid's intervention.
      const wasSelected = wasSelectedBeforeClickRef.current;
      // Force the node back to its pre-click state, then apply our toggle
      node.setSelected(wasSelected, false);
      // Now toggle: if was selected → deselect, if not → select
      node.setSelected(!wasSelected, false);
      lastSelectedIndexRef.current = rowIndex;
      return;
    }

    // Simple click: select only this row.
    // Use the pre-click state since AG-Grid may have already modified selection.
    const wasSelected = wasSelectedBeforeClickRef.current;
    const selectedCount = event.api.getSelectedRows().length;
    if (wasSelected && selectedCount === 1) {
      // Already the only selected row → deselect
      node.setSelected(false, false);
      lastSelectedIndexRef.current = null;
    } else {
      // Clear all and select only this one
      event.api.deselectAll();
      node.setSelected(true, false);
      lastSelectedIndexRef.current = rowIndex;
    }
  }, []);

  // Long-press detection for touch devices.  When the user holds their
  // finger on a cell for ~500ms we toggle the row's selection without
  // clearing others — the same behaviour as Ctrl+click on desktop — and
  // enter "drag" mode so that dragging over subsequent rows applies the
  // same action (select or deselect) to each row the pointer passes over.
  const handleCellMouseDown = useCallback((event: CellMouseDownEvent<MatriculationRow>) => {
    if (!event.node) return;
    // Capture selection state before AG-Grid's internal Ctrl+click handling
    wasSelectedBeforeClickRef.current = event.node.isSelected();
    longPressTriggeredRef.current = false;
    isDragSelectingRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      const node = event.node;
      if (node) {
        const wasSelected = node.isSelected();
        // Toggle: if already selected → deselect, if not → select.
        node.setSelected(!wasSelected, false);
        lastSelectedIndexRef.current = node.rowIndex ?? null;
        // Always enter drag mode.  The mode determines whether dragging
        // selects or deselects subsequent rows.
        isDragSelectingRef.current = true;
        dragModeRef.current = wasSelected ? 'deselect' : 'select';
      }
    }, 500);
  }, []);

  // While drag-selecting, apply the drag mode (select or deselect) to each
  // row the pointer enters.  Check that a button is still pressed
  // (buttons > 0) so that simply moving the mouse without holding the
  // button doesn't keep selecting/deselecting.
  const handleCellMouseOver = useCallback((event: CellMouseOverEvent<MatriculationRow>) => {
    if (!isDragSelectingRef.current) return;
    const mouseEvent = event.event as MouseEvent | undefined;
    if (mouseEvent && mouseEvent.buttons === 0) {
      // No button pressed — abort drag
      isDragSelectingRef.current = false;
      return;
    }
    const node = event.node;
    if (!node) return;
    if (dragModeRef.current === 'select') {
      if (!node.isSelected()) {
        node.setSelected(true, false);
        lastSelectedIndexRef.current = node.rowIndex ?? null;
      }
    } else {
      // deselect mode
      if (node.isSelected()) {
        node.setSelected(false, false);
        lastSelectedIndexRef.current = node.rowIndex ?? null;
      }
    }
  }, []);

  // Cancel long-press if the pointer releases quickly.  If we're already
  // drag-selecting, end the drag instead.
  const handleCellMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isDragSelectingRef.current = false;
  }, []);

  // Global mouseup/touchend listener — acts as a safety net so that
  // isDragSelectingRef is always cleared even if the pointer is released
  // outside the grid (where onCellMouseUp wouldn't fire).
  useEffect(() => {
    const endDrag = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      isDragSelectingRef.current = false;
    };
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);
    return () => {
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('touchcancel', endDrag);
    };
  }, []);

  // Cancel a *pending* long-press when the body scrolls (user is scrolling,
  // not holding).  But if we're already drag-selecting, don't cancel — the
  // scroll event fires naturally as rows are selected during the drag.
  const handleBodyScroll = useCallback(() => {
    if (isDragSelectingRef.current) return;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
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
        if (node.data?.id === event.data!.id) node.setSelected(true, false);
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
        node.setSelected(targetSelected.has(node.data.id), false);
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
          onCellMouseDown={handleCellMouseDown}
          onCellMouseUp={handleCellMouseUp}
          onCellMouseOver={handleCellMouseOver}
          onCellContextMenu={handleCellContextMenu}
          onColumnResized={handleColumnResized}
          onColumnMoved={handleColumnMoved}
          onSortChanged={handleSortChanged}
          onBodyScroll={handleBodyScroll}
        />
      </div>
    </AgGridProvider>
  );
};

export default MatriculationAgGrid;
