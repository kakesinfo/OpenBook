package fr.openbook.api.migration;

import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;

/**
 * Liquibase Java migration that groups existing reading_session rows into
 * reading_cycle records (based on start/progress/end boundaries per user and book),
 * links each session via reading_cycle_id, and migrates is_common to reading_cycle.
 */
public class MigrateReadingSessionsToCyclesChange implements CustomTaskChange {

    private static final int SESSION_TYPE_START = 0;
    private static final int SESSION_TYPE_END = 2;

    private record SessionRow(
            int id,
            int userId,
            int bookId,
            int sessionType,
            boolean isCommon,
            Timestamp createdAt
    ) {}

    @Override
    public void execute(Database database) throws CustomChangeException {
        try {
            JdbcConnection jdbcConnection = (JdbcConnection) database.getConnection();
            migrateConnection(jdbcConnection.getUnderlyingConnection());
        } catch (Exception ex) {
            throw new CustomChangeException("Failed to migrate reading_session rows into reading_cycle records", ex);
        }
    }

    /**
     * Migrates all reading_session rows where reading_cycle_id IS NULL into reading_cycle records.
     *
     * @return number of reading_cycle records created
     */
    public static int migrateConnection(Connection conn) throws SQLException {
        List<SessionRow> rows = new ArrayList<>();
        String selectSql =
                "SELECT id, user_id, book_id, session_type, COALESCE(is_common, FALSE) AS is_common, created_at " +
                "FROM reading_session " +
                "WHERE reading_cycle_id IS NULL " +
                "ORDER BY user_id ASC, book_id ASC, created_at ASC, session_type ASC, id ASC";

        try (PreparedStatement ps = conn.prepareStatement(selectSql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                rows.add(new SessionRow(
                        rs.getInt("id"),
                        rs.getInt("user_id"),
                        rs.getInt("book_id"),
                        rs.getInt("session_type"),
                        rs.getBoolean("is_common"),
                        rs.getTimestamp("created_at")
                ));
            }
        }

        if (rows.isEmpty()) {
            return 0;
        }

        String insertCycleSql =
                "INSERT INTO reading_cycle (user_id, book_id, is_common, started_at, ended_at, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)";
        String updateSessionSql = "UPDATE reading_session SET reading_cycle_id = ? WHERE id = ?";

        int cyclesCreated = 0;
        try (PreparedStatement insertCyclePs = conn.prepareStatement(insertCycleSql, new String[]{"id"});
             PreparedStatement updateSessionPs = conn.prepareStatement(updateSessionSql)) {

            List<SessionRow> currentGroup = new ArrayList<>();
            Integer currentUserId = null;
            Integer currentBookId = null;

            for (SessionRow row : rows) {
                boolean sameBook = currentUserId != null
                        && currentUserId == row.userId()
                        && currentBookId != null
                        && currentBookId == row.bookId();

                if (!sameBook) {
                    if (!currentGroup.isEmpty()) {
                        flushGroup(currentGroup, insertCyclePs, updateSessionPs);
                        cyclesCreated++;
                        currentGroup.clear();
                    }
                    currentUserId = row.userId();
                    currentBookId = row.bookId();
                }

                if (row.sessionType() == SESSION_TYPE_START) {
                    boolean currentHasBoundary = currentGroup.stream()
                            .anyMatch(r -> r.sessionType() == SESSION_TYPE_START || r.sessionType() == SESSION_TYPE_END);
                    if (!currentGroup.isEmpty() && currentHasBoundary) {
                        flushGroup(currentGroup, insertCyclePs, updateSessionPs);
                        cyclesCreated++;
                        currentGroup.clear();
                    }
                    currentGroup.add(row);
                } else if (row.sessionType() == SESSION_TYPE_END) {
                    currentGroup.add(row);
                    flushGroup(currentGroup, insertCyclePs, updateSessionPs);
                    cyclesCreated++;
                    currentGroup.clear();
                } else {
                    currentGroup.add(row);
                }
            }

            if (!currentGroup.isEmpty()) {
                flushGroup(currentGroup, insertCyclePs, updateSessionPs);
                cyclesCreated++;
                currentGroup.clear();
            }
        }

        return cyclesCreated;
    }

    private static void flushGroup(
            List<SessionRow> group,
            PreparedStatement insertCyclePs,
            PreparedStatement updateSessionPs
    ) throws SQLException {
        SessionRow first = group.get(0);
        SessionRow last = group.get(group.size() - 1);

        Timestamp startedAt = null;
        Timestamp endedAt = null;
        boolean isCommon = false;

        for (SessionRow r : group) {
            if (r.sessionType() == SESSION_TYPE_START && startedAt == null) {
                startedAt = r.createdAt();
            }
            if (r.sessionType() == SESSION_TYPE_END) {
                endedAt = r.createdAt();
            }
            if (r.isCommon()) {
                isCommon = true;
            }
        }

        if (startedAt == null) {
            startedAt = first.createdAt();
        }
        Timestamp updatedAt = last.createdAt() != null ? last.createdAt() : startedAt;

        insertCyclePs.setInt(1, first.userId());
        insertCyclePs.setInt(2, first.bookId());
        insertCyclePs.setBoolean(3, isCommon);
        insertCyclePs.setTimestamp(4, startedAt);
        if (endedAt != null) {
            insertCyclePs.setTimestamp(5, endedAt);
        } else {
            insertCyclePs.setNull(5, Types.TIMESTAMP);
        }
        insertCyclePs.setTimestamp(6, startedAt);
        insertCyclePs.setTimestamp(7, updatedAt);
        insertCyclePs.executeUpdate();

        int cycleId;
        try (ResultSet keys = insertCyclePs.getGeneratedKeys()) {
            if (!keys.next()) {
                throw new SQLException("Failed to obtain generated id for reading_cycle");
            }
            cycleId = keys.getInt(1);
        }

        for (SessionRow r : group) {
            updateSessionPs.setInt(1, cycleId);
            updateSessionPs.setInt(2, r.id());
            updateSessionPs.addBatch();
        }
        updateSessionPs.executeBatch();
    }

    @Override
    public String getConfirmationMessage() {
        return "Migrated existing reading_session rows into reading_cycle records";
    }

    @Override
    public void setUp() throws SetupException {
        // No setup needed
    }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        // No resource accessor needed
    }

    @Override
    public ValidationErrors validate(Database database) {
        return new ValidationErrors();
    }
}
