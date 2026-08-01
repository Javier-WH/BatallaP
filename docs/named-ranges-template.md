# Named Ranges del Template Excel

El template utiliza Named Ranges para llenar datos por nombre de celda.

## Institucion (11 nombres)

| Named Range | Descripcion |
|---|---|
| inst_period | Ano Escolar |
| inst_eval_type | Tipo de Evaluacion |
| inst_code | Codigo DEA |
| inst_name | Denominacion |
| inst_address | Direccion |
| inst_phone | Telefono |
| inst_municipality | Municipio |
| inst_state | Entidad Federal |
| inst_cdcee | CDCEE |
| inst_director | Director(a) |
| inst_director_doc | Cedula del Director(a) |

## Materias (fila 15)

| Named Range | Descripcion |
|---|---|
| subj_1 .. subj_12 | Header de materia N (contiene abreviatura) |

## Estudiante N (N=1..35, filas 16-50)

| Named Range | Descripcion | Columna |
|---|---|---|
| std_num_N | N de lista | A |
| std_doc_N | Cedula | B |
| std_ln_N | Apellidos |  D|
| std_fn_N | Nombres | F |
| std_bp_N | Lugar Nacimiento | H |
| std_ef_N | Entidad Federal | I |
| std_sx_N | Sexo | J |
| std_bd_N | Dia | K |
| std_bm_N | Mes | L |
| std_by_N | Ano | M |
| grade_1_N .. grade_12_N | Nota materia N | var |
| std_part_N | Participacion | var |

## Totales por hoja

| Hoja | Materias | Named Ranges |
|---|---|---|
| 1er Ano | 9 | 720 |
| 3er Ano | 10 | 756 |
| 4to Ano | 11 | 792 |
| 5to Ano | 12 | 828 |
| Total | | 3096 |

## Mantenimiento

Para regenerar: cd backend && node scripts/addNamedRanges.cjs
