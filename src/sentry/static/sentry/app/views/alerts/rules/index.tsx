import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';

import {t, tct} from 'app/locale';
import {IconCheckmark, IconArrow} from 'app/icons';
import {Organization, Project} from 'app/types';
import {IssueAlertRule} from 'app/types/alerts';
import {PageContent} from 'app/styles/organization';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import Projects from 'app/utils/projects';
import withOrganization from 'app/utils/withOrganization';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {addErrorMessage} from 'app/actionCreators/indicator';

import AlertHeader from '../list/header';
import {isIssueAlert} from '../utils';
import {TableLayout} from './styles';
import RuleListRow from './row';

const DEFAULT_SORT: {asc: boolean; field: 'date_added'} = {
  asc: false,
  field: 'date_added',
};
const DOCS_URL =
  'https://docs.sentry.io/workflow/alerts-notifications/alerts/?_ga=2.21848383.580096147.1592364314-1444595810.1582160976';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
};

type State = {
  ruleList?: IssueAlertRule[];
};

class AlertRulesList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): [string, string, any][] {
    const {params, location} = this.props;
    const {query} = location;

    return [
      [
        'ruleList',
        `/organizations/${params && params.orgId}/combined-rules/`,
        {
          query,
        },
      ],
    ];
  }

  tryRenderEmpty() {
    const {ruleList} = this.state;
    if (ruleList && ruleList.length > 0) {
      return null;
    }

    return (
      <EmptyMessage
        size="medium"
        icon={<IconCheckmark isCircled size="48" />}
        title={t('No alert rules exist for these projects.')}
        description={tct('Learn more about [link:Alerts]', {
          link: <ExternalLink href={DOCS_URL} />,
        })}
      />
    );
  }

  handleDeleteRule = async (projectId: string, ruleId: string) => {
    const {params} = this.props;
    const {orgId} = params;

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/alert-rules/${ruleId}/`,
        {
          method: 'DELETE',
        }
      );
      this.reloadData();
    } catch (_err) {
      addErrorMessage(t('Error deleting rule'));
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderList() {
    const {loading, ruleList = [], ruleListPageLinks} = this.state;
    const {orgId} = this.props.params;
    const {query} = this.props.location;

    const allProjectsFromIncidents = new Set(
      flatten(ruleList?.map(({projects}) => projects))
    );

    const sort = {
      ...DEFAULT_SORT,
      asc: query.asc === '1',
      // Currently only supported sorting field is 'date_added'
    };

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <TableLayout>
              <div>{t('Type')}</div>
              <div>{t('Alert Name')}</div>
              <div>{t('Project')}</div>
              <div>{t('Created By')}</div>
              <div>
                <StyledSortLink
                  to={{
                    pathname: `/organizations/${orgId}/alerts/rules/`,
                    query: {
                      asc: sort.asc ? undefined : '1',
                    },
                  }}
                >
                  {t('Created')}{' '}
                  <IconArrow
                    color="gray500"
                    size="xs"
                    direction={sort.asc ? 'up' : 'down'}
                  />
                </StyledSortLink>
              </div>
              <div>{t('Actions')}</div>
            </TableLayout>
          </PanelHeader>

          {loading ? (
            <LoadingIndicator />
          ) : (
            this.tryRenderEmpty() ?? (
              <PanelBody>
                <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
                  {({initiallyLoaded, projects}) =>
                    ruleList.map(rule => (
                      <RuleListRow
                        // Metric and issue alerts can have the same id
                        key={`${isIssueAlert(rule) ? 'metric' : 'issue'}-${rule.id}`}
                        projectsLoaded={initiallyLoaded}
                        projects={projects as Project[]}
                        rule={rule}
                        orgId={orgId}
                        onDelete={this.handleDeleteRule}
                      />
                    ))
                  }
                </Projects>
              </PanelBody>
            )
          )}
        </Panel>

        <Pagination pageLinks={ruleListPageLinks} />
      </React.Fragment>
    );
  }

  renderBody() {
    const {params, organization, router} = this.props;
    const {orgId} = params;

    return (
      <SentryDocumentTitle title="Alerts" objSlug={orgId}>
        <GlobalSelectionHeader organization={organization} showDateSelector={false}>
          <PageContent>
            <AlertHeader organization={organization} router={router} activeTab="rules" />
            {this.renderList()}
          </PageContent>
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

class AlertRulesListContainer extends React.Component<Props> {
  componentDidMount() {
    this.trackView();
  }

  componentDidUpdate(nextProps: Props) {
    if (nextProps.location.query?.sort !== this.props.location.query?.sort) {
      this.trackView();
    }
  }

  trackView() {
    const {organization, location} = this.props;

    trackAnalyticsEvent({
      eventKey: 'alert_rules.viewed',
      eventName: 'Alert Rules: Viewed',
      organization_id: organization.id,
      sort: location.query.sort,
    });
  }

  render() {
    return <AlertRulesList {...this.props} />;
  }
}

export default withOrganization(AlertRulesListContainer);

const StyledSortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }
`;
